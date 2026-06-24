import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { calculateExecutionScore, getProjectExecutionScore, type ExecutionScore } from '@/lib/momentum/execution-score'
import { calculateWorkspaceHealth, type WorkspaceHealthSnapshot } from '@/lib/momentum/health-snapshot'
import { recoveryConfidence, successProbability } from '@/lib/momentum/recovery-confidence'
import { evaluateRecoveryTriggers } from '@/lib/momentum/recovery-triggers'
import { getProject } from '@/lib/momentum/projects/project-service'
import { listProjectTasks } from '@/lib/momentum/tasks/task-service'
import type { ProjectDetail } from '@/types/project'
import type { TaskItem, TaskPriority, TaskStatus } from '@/types/task'

export type RecoveryPlanStatus = 'proposed' | 'applied' | 'dismissed'

export type RecoveryActionType =
  | 'reschedule_task'
  | 'reprioritize_task'
  | 'split_overloaded_work'
  | 'reduce_deadline_risk'
  | 'start_task'

export type RecoveryAction = {
  id: string
  type: RecoveryActionType
  task_id: string
  task_title: string
  reason: string
  impact: string
  from?: string | null
  to?: string | null
}

export type RecoveryImpact = {
  before_execution_score: number
  after_execution_score: number
  before_health: WorkspaceHealthSnapshot
  after_health: WorkspaceHealthSnapshot
  before_success_probability: number
  after_success_probability: number
  confidence_score: number
}

export type RecoveryPlan = {
  id?: string
  project_id: string
  status: RecoveryPlanStatus
  trigger_reasons: string[]
  summary: string
  actions: RecoveryAction[]
  impact: RecoveryImpact
  metadata: {
    generated_at: string
    remaining_work_days: number
    action_count: number
  }
  created_at?: string
  updated_at?: string
}

type RecoveryPlanRow = {
  id: string
  project_id: string
  status: RecoveryPlanStatus
  trigger_reasons: string[]
  summary: string
  actions: RecoveryAction[]
  before_execution_score: number
  after_execution_score: number
  before_health: WorkspaceHealthSnapshot['level']
  after_health: WorkspaceHealthSnapshot['level']
  before_success_probability: number
  after_success_probability: number
  confidence_score: number
  metadata: RecoveryPlan['metadata']
  created_at: string
  updated_at: string
}

const PRIORITY_UPGRADE: Record<TaskPriority, TaskPriority> = {
  low: 'medium',
  medium: 'high',
  high: 'urgent',
  urgent: 'urgent',
}

function openTasks(tasks: TaskItem[]) {
  return tasks.filter((task) => !['done', 'cancelled'].includes(task.status))
}

function dueDate(task: TaskItem) {
  return task.due_at ? new Date(task.due_at).getTime() : Number.MAX_SAFE_INTEGER
}

function isoDatePlus(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(17, 0, 0, 0)
  return date.toISOString()
}

function isOverdue(task: TaskItem) {
  return Boolean(task.due_at && new Date(task.due_at).getTime() < Date.now() && !['done', 'cancelled'].includes(task.status))
}

function actionId(type: RecoveryActionType, taskId: string) {
  return `${type}:${taskId}`
}

function addUnique(actions: RecoveryAction[], action: RecoveryAction) {
  if (actions.some((candidate) => candidate.id === action.id)) return
  if (actions.length < 8) actions.push(action)
}

function generateRecoveryActions(tasks: TaskItem[], score: ExecutionScore): RecoveryAction[] {
  const actions: RecoveryAction[] = []
  const risks = score.top_risks
  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  const overdue = openTasks(tasks).filter(isOverdue).sort((a, b) => dueDate(a) - dueDate(b))
  const blocked = openTasks(tasks).filter((task) => task.status === 'blocked')
  const noDueDate = openTasks(tasks).filter((task) => !task.due_at)
  const overloaded = openTasks(tasks).filter((task) => (task.estimate_minutes ?? 0) >= 240)

  overdue.slice(0, 3).forEach((task, index) => {
    addUnique(actions, {
      id: actionId('reschedule_task', task.id),
      type: 'reschedule_task',
      task_id: task.id,
      task_title: task.title,
      reason: 'Task is overdue and currently pulling down execution health.',
      impact: 'Moves the task back into an achievable near-term slot.',
      from: task.due_at,
      to: isoDatePlus(index + 1),
    })
  })

  blocked.slice(0, 2).forEach((task) => {
    addUnique(actions, {
      id: actionId('start_task', task.id),
      type: 'start_task',
      task_id: task.id,
      task_title: task.title,
      reason: task.blocked_reason || 'Task is blocked.',
      impact: 'Converts a blocked item into active recovery work.',
      from: task.status,
      to: 'in_progress',
    })
  })

  risks.forEach((risk) => {
    const task = tasksById.get(risk.task_id)
    if (!task || task.status === 'done' || task.status === 'cancelled') return
    const nextPriority = PRIORITY_UPGRADE[task.priority]
    if (nextPriority !== task.priority) {
      addUnique(actions, {
        id: actionId('reprioritize_task', task.id),
        type: 'reprioritize_task',
        task_id: task.id,
        task_title: task.title,
        reason: risk.explanation,
        impact: 'Raises the work in the queue so it is less likely to drift.',
        from: task.priority,
        to: nextPriority,
      })
    }
  })

  noDueDate.slice(0, 2).forEach((task, index) => {
    addUnique(actions, {
      id: actionId('reduce_deadline_risk', task.id),
      type: 'reduce_deadline_risk',
      task_id: task.id,
      task_title: task.title,
      reason: 'Task has no due date, which lowers scheduling confidence.',
      impact: 'Adds a concrete date so the task can be planned against capacity.',
      from: null,
      to: isoDatePlus(index + 2),
    })
  })

  overloaded.slice(0, 2).forEach((task) => {
    addUnique(actions, {
      id: actionId('split_overloaded_work', task.id),
      type: 'split_overloaded_work',
      task_id: task.id,
      task_title: task.title,
      reason: `Estimate is ${task.estimate_minutes} minutes.`,
      impact: 'Splits a large task into smaller execution chunks.',
      from: `${task.estimate_minutes}`,
      to: `${Math.ceil((task.estimate_minutes ?? 240) / 3)} minute chunks`,
    })
  })

  return actions
}

function applyActionsForProjection(tasks: TaskItem[], actions: RecoveryAction[]) {
  const actionsByTask = new Map<string, RecoveryAction[]>()
  actions.forEach((action) => {
    actionsByTask.set(action.task_id, [...(actionsByTask.get(action.task_id) ?? []), action])
  })

  return tasks.map((task) => {
    const next = { ...task }
    for (const action of actionsByTask.get(task.id) ?? []) {
      if ((action.type === 'reschedule_task' || action.type === 'reduce_deadline_risk') && action.to) {
        next.due_at = action.to
      }
      if (action.type === 'reprioritize_task' && action.to) {
        next.priority = action.to as TaskPriority
      }
      if (action.type === 'start_task') {
        next.status = 'in_progress' as TaskStatus
        next.blocked_reason = null
        next.blocked_at = null
        next.started_at = next.started_at ?? new Date().toISOString()
      }
      if (action.type === 'split_overloaded_work') {
        next.estimate_minutes = Math.max(60, Math.ceil((next.estimate_minutes ?? 240) / 3))
      }
    }
    return next
  })
}

function healthForPersistedLevel(level: WorkspaceHealthSnapshot['level'], executionScore: number): WorkspaceHealthSnapshot {
  return {
    scope: 'project',
    project_id: null,
    level,
    label: level === 'critical' ? 'Critical' : level === 'attention' ? 'Needs Attention' : 'Healthy',
    color: level === 'critical' ? 'red' : level === 'attention' ? 'yellow' : 'green',
    execution_score: executionScore,
    critical_risks: 0,
    high_risks: 0,
    overdue_tasks: 0,
    open_tasks: 0,
    reasons: [],
    calculated_at: new Date().toISOString(),
  }
}

function planSummary(before: number, after: number, health: WorkspaceHealthSnapshot, afterHealth: WorkspaceHealthSnapshot) {
  if (after > before) {
    return `Recovery plan improves execution from ${before} to ${after} and moves health from ${health.label} to ${afterHealth.label}.`
  }
  return `Recovery plan stabilizes ${health.label} work by reducing overdue pressure and clarifying the next actions.`
}

function rowToPlan(row: RecoveryPlanRow): RecoveryPlan {
  return {
    id: row.id,
    project_id: row.project_id,
    status: row.status,
    trigger_reasons: row.trigger_reasons,
    summary: row.summary,
    actions: row.actions,
    impact: {
      before_execution_score: row.before_execution_score,
      after_execution_score: row.after_execution_score,
      before_health: healthForPersistedLevel(row.before_health, row.before_execution_score),
      after_health: healthForPersistedLevel(row.after_health, row.after_execution_score),
      before_success_probability: row.before_success_probability,
      after_success_probability: row.after_success_probability,
      confidence_score: row.confidence_score,
    },
    metadata: row.metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function buildRecoveryPlan(projectId: string): Promise<RecoveryPlan> {
  const [project, tasks, beforeScore] = await Promise.all([
    getProject(projectId),
    listProjectTasks(projectId),
    getProjectExecutionScore(projectId),
  ])
  const beforeHealth = calculateWorkspaceHealth(beforeScore)
  const triggers = evaluateRecoveryTriggers(beforeScore, beforeHealth)
  const actions = generateRecoveryActions(tasks, beforeScore)
  const projectedTasks = applyActionsForProjection(tasks, actions)
  const afterScore = calculateExecutionScore(projectedTasks, { scope: 'project', projectId })
  const afterHealth = calculateWorkspaceHealth(afterScore)
  const beforeProbability = successProbability(project as ProjectDetail, tasks, beforeScore)
  const afterProbability = Math.max(beforeProbability, successProbability(project as ProjectDetail, projectedTasks, afterScore))
  const confidence = recoveryConfidence(project as ProjectDetail, tasks, beforeScore, afterScore)

  return {
    project_id: projectId,
    status: 'proposed',
    trigger_reasons: triggers.reasons.length > 0 ? triggers.reasons : ['Manual recovery requested.'],
    summary: planSummary(beforeScore.score, afterScore.score, beforeHealth, afterHealth),
    actions,
    impact: {
      before_execution_score: beforeScore.score,
      after_execution_score: afterScore.score,
      before_health: beforeHealth,
      after_health: afterHealth,
      before_success_probability: beforeProbability,
      after_success_probability: afterProbability,
      confidence_score: confidence,
    },
    metadata: {
      generated_at: new Date().toISOString(),
      remaining_work_days: Math.max(1, project.target_deadline ? Math.ceil((new Date(project.target_deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : 7),
      action_count: actions.length,
    },
  }
}

export async function createRecoveryPlan(projectId: string, userId: string) {
  const plan = await buildRecoveryPlan(projectId)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('recovery_plans')
    .insert({
      project_id: projectId,
      created_by: userId,
      status: plan.status,
      trigger_reasons: plan.trigger_reasons,
      summary: plan.summary,
      actions: plan.actions,
      before_execution_score: plan.impact.before_execution_score,
      after_execution_score: plan.impact.after_execution_score,
      before_health: plan.impact.before_health.level,
      after_health: plan.impact.after_health.level,
      before_success_probability: plan.impact.before_success_probability,
      after_success_probability: plan.impact.after_success_probability,
      confidence_score: plan.impact.confidence_score,
      metadata: plan.metadata,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return rowToPlan(data as RecoveryPlanRow)
}

export async function listRecoveryPlans(projectId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('recovery_plans')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as RecoveryPlanRow[]).map(rowToPlan)
}
