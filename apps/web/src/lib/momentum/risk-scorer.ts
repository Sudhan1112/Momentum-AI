import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { getTask, listProjectTasks } from '@/lib/momentum/tasks/task-service'
import type { TaskItem, TaskStatus } from '@/types/task'
import { calendarDayDifference } from '@/lib/momentum/date'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type RiskFactor = {
  key: 'due_date_proximity' | 'task_status' | 'overdue_duration' | 'project_completion_rate'
  label: string
  contribution: number
  reason: string
}

export type TaskRiskScore = {
  task_id: string
  project_id: string
  task_title: string
  project_title?: string
  score: number
  score_100: number
  level: RiskLevel
  confidence: number
  factors: RiskFactor[]
  explanation: string
  calculated_at: string
}

const CLOSED_STATUSES = new Set<TaskStatus>(['done', 'cancelled'])

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function roundScore(value: number) {
  return Math.round(clamp(value) * 10000) / 10000
}

function daysUntil(date: string, now: Date) {
  return calendarDayDifference(now, date)
}

function riskLevel(score: number): RiskLevel {
  if (score >= 0.75) return 'critical'
  if (score >= 0.55) return 'high'
  if (score >= 0.3) return 'medium'
  return 'low'
}

function dueDateFactor(task: TaskItem, now: Date): RiskFactor {
  if (!task.due_at) {
    return {
      key: 'due_date_proximity',
      label: 'Due date proximity',
      contribution: 0.04,
      reason: 'No due date, so the task has low scheduling confidence.',
    }
  }

  const remainingDays = daysUntil(task.due_at, now)
  if (remainingDays == null) {
    return {
      key: 'due_date_proximity',
      label: 'Due date proximity',
      contribution: 0.04,
      reason: 'The stored due date is invalid, so scheduling confidence is low.',
    }
  }

  if (remainingDays < 0) {
    return {
      key: 'due_date_proximity',
      label: 'Due date proximity',
      contribution: 0.25,
      reason: `Due date passed ${Math.abs(remainingDays)} day${Math.abs(remainingDays) === 1 ? '' : 's'} ago.`,
    }
  }

  if (remainingDays === 0) {
    return {
      key: 'due_date_proximity',
      label: 'Due date proximity',
      contribution: 0.22,
      reason: 'Due today.',
    }
  }

  if (remainingDays <= 2) {
    return {
      key: 'due_date_proximity',
      label: 'Due date proximity',
      contribution: 0.18,
      reason: `Due in ${remainingDays} day${remainingDays === 1 ? '' : 's'}.`,
    }
  }

  if (remainingDays <= 7) {
    return {
      key: 'due_date_proximity',
      label: 'Due date proximity',
      contribution: 0.1,
      reason: `Due within ${remainingDays} days.`,
    }
  }

  return {
    key: 'due_date_proximity',
    label: 'Due date proximity',
    contribution: 0.02,
    reason: `Due in ${remainingDays} days.`,
  }
}

function statusFactor(task: TaskItem): RiskFactor {
  if (task.status === 'blocked') {
    return {
      key: 'task_status',
      label: 'Task status',
      contribution: 0.25,
      reason: task.blocked_reason ? `Blocked: ${task.blocked_reason}` : 'Blocked tasks cannot move without intervention.',
    }
  }

  if (task.status === 'backlog') {
    return {
      key: 'task_status',
      label: 'Task status',
      contribution: 0.1,
      reason: 'Still in backlog.',
    }
  }

  if (task.status === 'todo') {
    return {
      key: 'task_status',
      label: 'Task status',
      contribution: 0.08,
      reason: 'Not started yet.',
    }
  }

  return {
    key: 'task_status',
    label: 'Task status',
    contribution: 0.04,
    reason: 'Already in progress.',
  }
}

function overdueDurationFactor(task: TaskItem, now: Date): RiskFactor {
  if (!task.due_at) {
    return {
      key: 'overdue_duration',
      label: 'Overdue duration',
      contribution: 0,
      reason: 'No overdue duration because there is no due date.',
    }
  }

  const remainingDays = daysUntil(task.due_at, now)
  if (remainingDays == null) {
    return {
      key: 'overdue_duration',
      label: 'Overdue duration',
      contribution: 0,
      reason: 'The stored due date is invalid and cannot be treated as overdue.',
    }
  }
  if (remainingDays >= 0) {
    return {
      key: 'overdue_duration',
      label: 'Overdue duration',
      contribution: 0,
      reason: 'Not overdue.',
    }
  }

  const overdueDays = Math.abs(remainingDays)
  return {
    key: 'overdue_duration',
    label: 'Overdue duration',
    contribution: clamp(overdueDays * 0.04, 0, 0.2),
    reason: `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue.`,
  }
}

function projectCompletionFactor(projectTasks: TaskItem[]): RiskFactor {
  const counted = projectTasks.filter((task) => task.status !== 'cancelled')
  if (counted.length === 0) {
    return {
      key: 'project_completion_rate',
      label: 'Project completion rate',
      contribution: 0.08,
      reason: 'No completed task history yet.',
    }
  }

  const completed = counted.filter((task) => task.status === 'done').length
  const completionRate = completed / counted.length

  if (completionRate < 0.25) {
    return {
      key: 'project_completion_rate',
      label: 'Project completion rate',
      contribution: 0.15,
      reason: `Project completion is ${Math.round(completionRate * 100)}%.`,
    }
  }

  if (completionRate < 0.5) {
    return {
      key: 'project_completion_rate',
      label: 'Project completion rate',
      contribution: 0.1,
      reason: `Project completion is ${Math.round(completionRate * 100)}%.`,
    }
  }

  return {
    key: 'project_completion_rate',
    label: 'Project completion rate',
    contribution: 0.04,
    reason: `Project completion is ${Math.round(completionRate * 100)}%.`,
  }
}

function confidenceFor(task: TaskItem, projectTasks: TaskItem[]) {
  const dueDateConfidence = task.due_at ? 0.15 : 0
  const estimateConfidence = task.estimate_minutes ? 0.1 : 0
  const projectHistoryConfidence = projectTasks.length >= 3 ? 0.1 : 0.04
  return roundScore(0.65 + dueDateConfidence + estimateConfidence + projectHistoryConfidence)
}

function explanationFor(score: number, factors: RiskFactor[]) {
  const materialFactors = factors
    .filter((factor) => factor.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map((factor) => factor.reason)

  if (materialFactors.length === 0) return 'Risk is low because this task is already closed.'
  return `Risk is ${riskLevel(score)} because ${materialFactors.join(' ')}`
}

export function scoreTaskRisk(task: TaskItem, projectTasks: TaskItem[], now = new Date()): TaskRiskScore {
  if (CLOSED_STATUSES.has(task.status)) {
    return {
      task_id: task.id,
      project_id: task.project_id,
      task_title: task.title,
      score: 0,
      score_100: 0,
      level: 'low',
      confidence: confidenceFor(task, projectTasks),
      factors: [
        {
          key: 'task_status',
          label: 'Task status',
          contribution: 0,
          reason: 'Task is closed.',
        },
      ],
      explanation: 'Risk is low because this task is already closed.',
      calculated_at: now.toISOString(),
    }
  }

  const factors = [
    dueDateFactor(task, now),
    statusFactor(task),
    overdueDurationFactor(task, now),
    projectCompletionFactor(projectTasks),
  ]
  const score = roundScore(factors.reduce((total, factor) => total + factor.contribution, 0))

  return {
    task_id: task.id,
    project_id: task.project_id,
    task_title: task.title,
    score,
    score_100: Math.round(score * 100),
    level: riskLevel(score),
    confidence: confidenceFor(task, projectTasks),
    factors,
    explanation: explanationFor(score, factors),
    calculated_at: now.toISOString(),
  }
}

export async function getTaskRiskScore(taskId: string) {
  const task = await getTask(taskId)
  const projectTasks = await listProjectTasks(task.project_id)
  return { ...scoreTaskRisk(task, projectTasks), project_title: task.project.title }
}

export async function getProjectRiskScores(projectId: string) {
  const tasks = await listProjectTasks(projectId)
  return tasks.map((task) => scoreTaskRisk(task, tasks)).sort((a, b) => b.score - a.score)
}

export async function persistTaskRiskScore(risk: TaskRiskScore) {
  const admin = createAdminClient()
  const { error } = await admin.from('task_risk_scores').insert({
    task_id: risk.task_id,
    project_id: risk.project_id,
    score: risk.score,
    level: risk.level,
    confidence: risk.confidence,
    factors: risk.factors,
    explanation: risk.explanation,
    scored_at: risk.calculated_at,
  })

  if (error) {
    console.warn('[risk] could not persist task risk score', error.message)
  }
}
