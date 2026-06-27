import 'server-only'

import { getProject, listProjectsForUser } from '@/lib/momentum/projects/project-service'
import { listProjectTasks } from '@/lib/momentum/tasks/task-service'
import { scoreTaskRisk, type TaskRiskScore } from '@/lib/momentum/risk-scorer'
import type { ProjectListItem } from '@/types/project'
import type { TaskItem } from '@/types/task'
import { calendarDayDifference, isOverdueTimestamp, parseTimestamp } from '@/lib/momentum/date'

export type ExecutionScoreComponent = {
  score: number
  max: number
  reason: string
}

export type ExecutionScore = {
  scope: 'workspace' | 'project'
  project_id: string | null
  score: number
  components: {
    completion: ExecutionScoreComponent
    overdue_control: ExecutionScoreComponent
    active_flow: ExecutionScoreComponent
    current_velocity: ExecutionScoreComponent
  }
  metrics: {
    total_tasks: number
    completed_tasks: number
    open_tasks: number
    overdue_tasks: number
    in_progress_tasks: number
    recently_completed_tasks: number
    average_risk: number
  }
  top_risks: TaskRiskScore[]
  explanation: string
  calculated_at: string
}

export type WorkspaceExecutionScore = ExecutionScore & {
  project_scores: Array<ExecutionScore & { project_title: string }>
}

const OPEN_STATUSES = new Set(['backlog', 'todo', 'in_progress', 'blocked'])

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function isOpenTask(task: TaskItem) {
  return OPEN_STATUSES.has(task.status)
}

function isOverdue(task: TaskItem, now: Date) {
  return isOpenTask(task) && isOverdueTimestamp(task.due_at, now)
}

function isRecentlyCompleted(task: TaskItem, now: Date) {
  if (task.status !== 'done' || !task.completed_at) return false
  const completed = parseTimestamp(task.completed_at)
  const age = completed ? calendarDayDifference(completed, now) : null
  return age != null && age >= 0 && age <= 7
}

function component(score: number, max: number, reason: string): ExecutionScoreComponent {
  return {
    score: Math.round(clamp(score / max) * max),
    max,
    reason,
  }
}

function completionComponent(tasks: TaskItem[]) {
  const counted = tasks.filter((task) => task.status !== 'cancelled')
  const completed = counted.filter((task) => task.status === 'done').length
  const rate = counted.length === 0 ? 0 : completed / counted.length
  return component(rate * 35, 35, `${completed}/${counted.length} counted tasks are complete.`)
}

function overdueComponent(openTasks: TaskItem[], overdueTasks: TaskItem[]) {
  if (openTasks.length === 0) return component(30, 30, 'No open tasks are overdue.')
  const cleanRate = 1 - overdueTasks.length / openTasks.length
  return component(cleanRate * 30, 30, `${overdueTasks.length}/${openTasks.length} open tasks are overdue.`)
}

function activeFlowComponent(openTasks: TaskItem[], inProgressTasks: TaskItem[]) {
  if (openTasks.length === 0) return component(15, 15, 'No open tasks need active flow.')
  if (inProgressTasks.length === 0) return component(5, 15, 'No open task is currently in progress.')
  const idealActive = Math.min(openTasks.length, 3)
  const flowRate = Math.min(inProgressTasks.length, idealActive) / idealActive
  return component(flowRate * 15, 15, `${inProgressTasks.length} task${inProgressTasks.length === 1 ? '' : 's'} in progress.`)
}

function velocityComponent(openTasks: TaskItem[], recentlyCompletedTasks: TaskItem[]) {
  if (openTasks.length === 0) return component(20, 20, 'No open task load remains.')
  const weeklyTarget = Math.max(1, Math.ceil(openTasks.length / 3))
  const velocityRate = Math.min(recentlyCompletedTasks.length / weeklyTarget, 1)
  return component(velocityRate * 20, 20, `${recentlyCompletedTasks.length}/${weeklyTarget} weekly completion target reached.`)
}

function explanationFor(score: number, metrics: ExecutionScore['metrics']) {
  if (metrics.total_tasks === 0) return 'Execution score is waiting for tasks.'
  if (score >= 80) return 'Execution is strong: completion, overdue control, and velocity are all supporting momentum.'
  if (score >= 60) return 'Execution is steady, but overdue work or low velocity is creating pressure.'
  if (score >= 40) return 'Execution needs attention: the workspace has visible drag from overdue, inactive, or unfinished work.'
  return 'Execution is critical: overdue pressure and weak velocity are blocking forward motion.'
}

export function calculateExecutionScore(
  tasks: TaskItem[],
  options: { scope: 'workspace' | 'project'; projectId?: string | null; now?: Date } = { scope: 'workspace' }
): ExecutionScore {
  const now = options.now ?? new Date()
  const openTasks = tasks.filter(isOpenTask)
  const overdueTasks = openTasks.filter((task) => isOverdue(task, now))
  const inProgressTasks = openTasks.filter((task) => task.status === 'in_progress')
  const recentlyCompletedTasks = tasks.filter((task) => isRecentlyCompleted(task, now))
  const risks = tasks.map((task) => scoreTaskRisk(task, tasks, now))
  const topRisks = risks.filter((risk) => risk.score > 0).sort((a, b) => b.score - a.score).slice(0, 5)

  const components = {
    completion: completionComponent(tasks),
    overdue_control: overdueComponent(openTasks, overdueTasks),
    active_flow: activeFlowComponent(openTasks, inProgressTasks),
    current_velocity: velocityComponent(openTasks, recentlyCompletedTasks),
  }

  const score =
    components.completion.score +
    components.overdue_control.score +
    components.active_flow.score +
    components.current_velocity.score

  const metrics = {
    total_tasks: tasks.filter((task) => task.status !== 'cancelled').length,
    completed_tasks: tasks.filter((task) => task.status === 'done').length,
    open_tasks: openTasks.length,
    overdue_tasks: overdueTasks.length,
    in_progress_tasks: inProgressTasks.length,
    recently_completed_tasks: recentlyCompletedTasks.length,
    average_risk: risks.length === 0 ? 0 : Math.round((risks.reduce((total, risk) => total + risk.score, 0) / risks.length) * 100),
  }

  return {
    scope: options.scope,
    project_id: options.projectId ?? null,
    score,
    components,
    metrics,
    top_risks: topRisks,
    explanation: explanationFor(score, metrics),
    calculated_at: now.toISOString(),
  }
}

export async function getProjectExecutionScore(projectId: string) {
  const [project, tasks] = await Promise.all([getProject(projectId), listProjectTasks(projectId)])
  const score = calculateExecutionScore(tasks, { scope: 'project', projectId })
  return {
    ...score,
    top_risks: score.top_risks.map((risk) => ({ ...risk, project_title: project.title })),
  }
}

export async function getWorkspaceExecutionScore(userId: string): Promise<WorkspaceExecutionScore> {
  const projects = await listProjectsForUser(userId)
  const projectEntries = await Promise.all(
    projects.map(async (project: ProjectListItem) => {
      const tasks = await listProjectTasks(project.id)
      return {
        project,
        tasks,
        score: calculateExecutionScore(tasks, { scope: 'project', projectId: project.id }),
      }
    })
  )

  const workspaceTasks = projectEntries.flatMap((entry) => entry.tasks)
  const projectTitles = new Map(projectEntries.map((entry) => [entry.project.id, entry.project.title]))
  const workspaceScore = calculateExecutionScore(workspaceTasks, { scope: 'workspace', projectId: null })

  return {
    ...workspaceScore,
    top_risks: workspaceScore.top_risks.map((risk) => ({ ...risk, project_title: projectTitles.get(risk.project_id) })),
    project_scores: projectEntries.map((entry) => ({
      ...entry.score,
      top_risks: entry.score.top_risks.map((risk) => ({ ...risk, project_title: entry.project.title })),
      project_title: entry.project.title,
    })),
  }
}
