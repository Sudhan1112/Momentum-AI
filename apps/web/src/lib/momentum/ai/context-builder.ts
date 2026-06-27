import 'server-only'

import { getProject } from '@/lib/momentum/projects/project-service'
import { listProjectTasks } from '@/lib/momentum/tasks/task-service'
import { validateOptionalUuid, validateRequiredUuid } from '@/lib/momentum/validation/schemas'
import { withCitations, type AiCitationSet } from '@/lib/momentum/ai/gateway'
import type { AiCitationInput } from '@/lib/momentum/ai/run-logger'
import type { ProjectDetail } from '@/types/project'
import type { TaskItem } from '@/types/task'
import { isOverdueTimestamp, timestampMs, toDateOnly } from '@/lib/momentum/date'

export type AiContextSource = AiCitationInput

export type ProjectAiContext = {
  kind: 'project'
  project: Pick<ProjectDetail, 'id' | 'title' | 'status' | 'target_deadline' | 'goal_summary' | 'execution_target_score'>
  tasks: Array<
    Pick<
      TaskItem,
      'id' | 'title' | 'status' | 'priority' | 'due_at' | 'estimate_minutes' | 'blocked_reason' | 'completed_at'
    >
  >
  sources: AiContextSource[]
  citations: AiCitationSet
  summary: string
}

export type BuildProjectContextInput = {
  projectId: string
  maxTasks?: number
}

function taskUrgency(task: TaskItem) {
  const due = timestampMs(task.due_at)
  const statusWeight = task.status === 'blocked' ? 0 : task.status === 'done' || task.status === 'cancelled' ? 2 : 1
  const priorityWeight = task.priority === 'urgent' ? -3 : task.priority === 'high' ? -2 : task.priority === 'medium' ? -1 : 0
  return due + statusWeight * 10_000_000 + priorityWeight
}

function taskExcerpt(task: TaskItem) {
  const due = task.due_at ? `due ${toDateOnly(task.due_at) ?? 'invalid date'}` : 'no due date'
  const estimate = task.estimate_minutes ? `${task.estimate_minutes}m estimate` : 'no estimate'
  const blocked = task.blocked_reason ? `, blocked: ${task.blocked_reason}` : ''
  return `${task.title} (${task.status}, ${task.priority}, ${due}, ${estimate}${blocked})`
}

export async function buildProjectContext(input: BuildProjectContextInput): Promise<ProjectAiContext> {
  validateRequiredUuid(input.projectId, 'project_id')
  const [project, tasks] = await Promise.all([getProject(input.projectId), listProjectTasks(input.projectId)])
  return buildProjectContextFromData(project, tasks, input.maxTasks)
}

export function buildProjectContextFromData(project: ProjectDetail, tasks: TaskItem[], maxTasksInput = 12): ProjectAiContext {
  const maxTasks = Math.max(1, Math.min(maxTasksInput, 25))
  const selectedTasks = [...tasks].sort((a, b) => taskUrgency(a) - taskUrgency(b)).slice(0, maxTasks)

  const sources: AiContextSource[] = [
    {
      sourceType: 'project',
      sourceId: project.id,
      excerpt: `${project.title}${project.goal_summary ? `: ${project.goal_summary}` : ''}`,
      metadata: { target_deadline: project.target_deadline, status: project.status },
      sortOrder: 0,
    },
    ...selectedTasks.map((task, index) => ({
      sourceType: 'task' as const,
      sourceId: task.id,
      excerpt: taskExcerpt(task),
      metadata: { project_id: task.project_id, due_at: task.due_at, status: task.status, priority: task.priority },
      sortOrder: index + 1,
    })),
  ]

  const openTasks = tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled').length
  const overdueTasks = tasks.filter(
    (task) => task.status !== 'done' && isOverdueTimestamp(task.due_at)
  ).length

  return {
    kind: 'project',
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
      target_deadline: project.target_deadline,
      goal_summary: project.goal_summary,
      execution_target_score: project.execution_target_score,
    },
    tasks: selectedTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      due_at: task.due_at,
      estimate_minutes: task.estimate_minutes,
      blocked_reason: task.blocked_reason,
      completed_at: task.completed_at,
    })),
    sources,
    citations: withCitations(sources),
    summary: `${project.title}: ${openTasks} open task(s), ${overdueTasks} overdue task(s), ${tasks.length} total task(s).`,
  }
}

export function serializeAiContext(context: ProjectAiContext) {
  return JSON.stringify(context, null, 2)
}

export function assertOptionalAiContextTarget(input: { projectId?: string | null; taskId?: string | null }) {
  validateOptionalUuid(input.projectId ?? null, 'project_id')
  validateOptionalUuid(input.taskId ?? null, 'task_id')
}
