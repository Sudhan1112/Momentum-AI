import 'server-only'

import type { ExecutionScore } from '@/lib/momentum/execution-score'
import type { ProjectDetail } from '@/types/project'
import type { TaskItem } from '@/types/task'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_DAILY_CAPACITY_MINUTES = 240

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function openTasks(tasks: TaskItem[]) {
  return tasks.filter((task) => !['done', 'cancelled'].includes(task.status))
}

export function remainingWorkDays(project: ProjectDetail, now = new Date()) {
  if (!project.target_deadline) return 7
  const deadline = new Date(project.target_deadline)
  return Math.max(1, Math.ceil((deadline.getTime() - now.getTime()) / MS_PER_DAY))
}

export function remainingWorkMinutes(tasks: TaskItem[]) {
  return openTasks(tasks).reduce((total, task) => total + (task.estimate_minutes ?? 120), 0)
}

export function successProbability(project: ProjectDetail, tasks: TaskItem[], score: ExecutionScore, now = new Date()) {
  const days = remainingWorkDays(project, now)
  const capacityMinutes = days * DEFAULT_DAILY_CAPACITY_MINUTES
  const loadRatio = remainingWorkMinutes(tasks) / Math.max(capacityMinutes, 1)
  const loadPenalty = Math.min(35, Math.max(0, (loadRatio - 0.85) * 35))
  const overduePenalty = Math.min(25, score.metrics.overdue_tasks * 7)
  const riskPenalty = Math.min(25, score.top_risks.filter((risk) => risk.level === 'critical' || risk.level === 'high').length * 6)

  return Math.round(clamp(score.score - loadPenalty - overduePenalty - riskPenalty + 18))
}

export function recoveryConfidence(project: ProjectDetail, tasks: TaskItem[], score: ExecutionScore, projectedScore: ExecutionScore, now = new Date()) {
  const days = remainingWorkDays(project, now)
  const loadRatio = remainingWorkMinutes(tasks) / Math.max(days * DEFAULT_DAILY_CAPACITY_MINUTES, 1)
  const scoreGain = Math.max(0, projectedScore.score - score.score)
  const loadPenalty = Math.min(28, Math.max(0, (loadRatio - 1) * 28))
  const overduePenalty = Math.min(24, score.metrics.overdue_tasks * 5)
  const velocityBonus = Math.min(18, score.metrics.recently_completed_tasks * 6)
  const dayBonus = Math.min(12, days * 2)

  return Math.round(clamp(45 + scoreGain * 0.7 + velocityBonus + dayBonus - loadPenalty - overduePenalty))
}
