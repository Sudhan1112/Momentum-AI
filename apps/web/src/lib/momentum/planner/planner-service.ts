import 'server-only'

import { listProjectsForUser } from '@/lib/momentum/projects/project-service'
import { listProjectTasks } from '@/lib/momentum/tasks/task-service'
import type { ProjectListItem } from '@/types/project'
import type { TaskItem, TaskPriority, TaskStatus } from '@/types/task'
import { calendarDayDifference, timestampMs } from '@/lib/momentum/date'

export type PlannerTask = Pick<
  TaskItem,
  | 'id'
  | 'project_id'
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'due_at'
  | 'estimate_minutes'
  | 'blocked_reason'
  | 'updated_at'
> & {
  project_title: string
  is_overdue: boolean
  is_due_today: boolean
}

export type PlannerProjectPulse = {
  id: string
  title: string
  status: ProjectListItem['status']
  target_deadline: string | null
  open_tasks: number
  completed_tasks: number
  blocked_tasks: number
  overdue_tasks: number
  due_today_tasks: number
  attention: 'clear' | 'due_today' | 'blocked' | 'overdue'
}

export type PlannerToday = {
  generated_at: string
  next_action: PlannerTask | null
  sections: {
    overdue: PlannerTask[]
    due_today: PlannerTask[]
    in_progress: PlannerTask[]
    blocked: PlannerTask[]
  }
  projects: PlannerProjectPulse[]
  brief: {
    headline: string
    narrative: string
    metrics: {
      open_tasks: number
      due_today: number
      overdue: number
      blocked: number
      completed: number
      active_projects: number
    }
  }
}

export type PlannerProjectData = {
  project: ProjectListItem
  tasks: TaskItem[]
}

const OPEN_STATUSES = new Set<TaskStatus>(['backlog', 'todo', 'in_progress', 'blocked'])
const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function dueTime(task: PlannerTask) {
  return timestampMs(task.due_at)
}

function statusWeight(status: TaskStatus) {
  if (status === 'in_progress') return 0
  if (status === 'todo') return 1
  if (status === 'backlog') return 2
  if (status === 'blocked') return 3
  return 4
}

function compareTasks(a: PlannerTask, b: PlannerTask) {
  if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1
  if (a.is_due_today !== b.is_due_today) return a.is_due_today ? -1 : 1
  const priorityDelta = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
  if (priorityDelta !== 0) return priorityDelta
  const statusDelta = statusWeight(a.status) - statusWeight(b.status)
  if (statusDelta !== 0) return statusDelta
  const dueDelta = dueTime(a) - dueTime(b)
  if (dueDelta !== 0) return dueDelta
  return timestampMs(b.updated_at, 0) - timestampMs(a.updated_at, 0)
}

function toPlannerTask(task: TaskItem, projectTitle: string, today: Date): PlannerTask {
  const dueDay = task.due_at ? calendarDayDifference(today, task.due_at) : null

  return {
    id: task.id,
    project_id: task.project_id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    due_at: task.due_at,
    estimate_minutes: task.estimate_minutes,
    blocked_reason: task.blocked_reason,
    updated_at: task.updated_at,
    project_title: projectTitle,
    is_overdue: Boolean(dueDay != null && dueDay < 0 && task.status !== 'done' && task.status !== 'cancelled'),
    is_due_today: dueDay === 0,
  }
}

function buildProjectPulse(project: ProjectListItem, tasks: PlannerTask[]): PlannerProjectPulse {
  const openTasks = tasks.filter((task) => OPEN_STATUSES.has(task.status)).length
  const completedTasks = tasks.filter((task) => task.status === 'done').length
  const blockedTasks = tasks.filter((task) => task.status === 'blocked').length
  const overdueTasks = tasks.filter((task) => task.is_overdue).length
  const dueTodayTasks = tasks.filter((task) => task.is_due_today && task.status !== 'done').length
  const attention: PlannerProjectPulse['attention'] =
    overdueTasks > 0 ? 'overdue' : blockedTasks > 0 ? 'blocked' : dueTodayTasks > 0 ? 'due_today' : 'clear'

  return {
    id: project.id,
    title: project.title,
    status: project.status,
    target_deadline: project.target_deadline,
    open_tasks: openTasks,
    completed_tasks: completedTasks,
    blocked_tasks: blockedTasks,
    overdue_tasks: overdueTasks,
    due_today_tasks: dueTodayTasks,
    attention,
  }
}

function buildNarrative(metrics: PlannerToday['brief']['metrics']) {
  if (metrics.active_projects === 0) {
    return 'Create a project and add a few tasks to turn Momentum AI into your execution cockpit.'
  }

  if (metrics.overdue > 0) {
    return `Start by clearing ${metrics.overdue} overdue task${metrics.overdue === 1 ? '' : 's'} before taking on new work.`
  }

  if (metrics.blocked > 0) {
    return `You have ${metrics.blocked} blocked task${metrics.blocked === 1 ? '' : 's'} that may slow momentum. Unblock one before deep work.`
  }

  if (metrics.due_today > 0) {
    return `Today has ${metrics.due_today} due task${metrics.due_today === 1 ? '' : 's'}. Pick the highest-priority item and keep the day narrow.`
  }

  return 'No urgent task pressure today. Use the next action to move one active project forward.'
}

export function buildPlannerTodayFromData(entries: PlannerProjectData[], today = new Date()): PlannerToday {
  const tasksByProject = entries.map(({ project, tasks }) => ({
    project,
    tasks: tasks.map((task) => toPlannerTask(task, project.title, today)),
  }))

  const tasks = tasksByProject.flatMap((entry) => entry.tasks)
  const openTasks = tasks.filter((task) => OPEN_STATUSES.has(task.status))
  const overdue = openTasks.filter((task) => task.is_overdue).sort(compareTasks)
  const dueToday = openTasks.filter((task) => task.is_due_today && !task.is_overdue).sort(compareTasks)
  const inProgress = openTasks.filter((task) => task.status === 'in_progress' && !task.is_overdue && !task.is_due_today).sort(compareTasks)
  const blocked = openTasks.filter((task) => task.status === 'blocked').sort(compareTasks)
  const nextAction = openTasks.filter((task) => task.status !== 'blocked').sort(compareTasks)[0] ?? blocked[0] ?? null

  const metrics = {
    open_tasks: openTasks.length,
    due_today: dueToday.length,
    overdue: overdue.length,
    blocked: blocked.length,
    completed: tasks.filter((task) => task.status === 'done').length,
    active_projects: entries.filter(({ project }) => project.status === 'active').length,
  }

  return {
    generated_at: new Date().toISOString(),
    next_action: nextAction,
    sections: {
      overdue,
      due_today: dueToday,
      in_progress: inProgress,
      blocked,
    },
    projects: tasksByProject.map((entry) => buildProjectPulse(entry.project, entry.tasks)),
    brief: {
      headline: metrics.active_projects > 0 ? 'Today is ready to execute.' : 'Set up your execution workspace.',
      narrative: buildNarrative(metrics),
      metrics,
    },
  }
}

export async function getPlannerToday(userId: string): Promise<PlannerToday> {
  const projects = await listProjectsForUser(userId)
  const entries = await Promise.all(
    projects.map(async (project) => ({
      project,
      tasks: await listProjectTasks(project.id),
    }))
  )

  return buildPlannerTodayFromData(entries)
}
