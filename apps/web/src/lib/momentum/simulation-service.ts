import 'server-only'

import { executeAiTextCapability, type AiExecutionContext, type AiFallbackReason } from '@/lib/momentum/ai/executor'
import { buildProjectContext } from '@/lib/momentum/ai/context-builder'
import { withCitations } from '@/lib/momentum/ai/gateway'
import { calculateExecutionScore, getProjectExecutionScore, type ExecutionScore } from '@/lib/momentum/execution-score'
import { calculateWorkspaceHealth, type WorkspaceHealthLevel, type WorkspaceHealthSnapshot } from '@/lib/momentum/health-snapshot'
import { badRequest } from '@/lib/momentum/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProject } from '@/lib/momentum/projects/project-service'
import { buildRecoveryPlan, listRecoveryPlans } from '@/lib/momentum/recovery-service'
import { scoreTaskRisk, type TaskRiskScore } from '@/lib/momentum/risk-scorer'
import { listProjectTasks } from '@/lib/momentum/tasks/task-service'
import { validateOptionalUuid, validateRequiredUuid } from '@/lib/momentum/validation/schemas'
import type { ProjectDetail } from '@/types/project'
import type { TaskItem } from '@/types/task'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_DAILY_HOURS = 4
const MIN_DAILY_HOURS = 0.5
const MAX_DAILY_HOURS = 16

export type GoalSimulationInput = {
  projectId: string
  targetDeadline?: string | null
  dailyWorkHours?: number | null
  extraDailyHours?: number | null
  delayTaskId?: string | null
  delayDays?: number | null
  shiftMilestoneDays?: number | null
  removeCompletedTasks?: boolean | null
}

export type NormalizedGoalSimulationInput = {
  projectId: string
  targetDeadline: string
  dailyWorkHours: number
  extraDailyHours: number
  delayTaskId: string | null
  delayDays: number
  shiftMilestoneDays: number
  removeCompletedTasks: boolean
}

export type SimulationTask = {
  id: string
  title: string
  status: string
  priority: string
  due_at: string | null
  estimate_minutes: number | null
}

export type TimelineProjection = {
  target_deadline: string
  estimated_finish_date: string
  remaining_work_minutes: number
  available_minutes: number
  daily_capacity_minutes: number
  remaining_days: number
  projected_duration_days: number
  schedule_delta_days: number
}

export type SimulationState = {
  success_probability: number
  execution_score: number
  workspace_health: WorkspaceHealthSnapshot
  average_risk: number
  high_or_critical_risks: number
}

export type SimulationRecommendedAction = {
  type: 'increase_capacity' | 'recover_project' | 'reduce_scope' | 'unblock_task' | 'move_deadline' | 'start_critical_task'
  label: string
  reason: string
}

export type GoalSimulation = {
  id: string | null
  project_id: string
  scenario_name: string
  inputs: NormalizedGoalSimulationInput
  current_state: SimulationState
  projected_state: SimulationState
  timeline_projection: TimelineProjection
  execution_score_change: number
  risk_change: number
  health_change: {
    from: WorkspaceHealthLevel
    to: WorkspaceHealthLevel
    label: string
  }
  critical_tasks: Array<TaskRiskScore & { due_at: string | null; estimate_minutes: number | null }>
  recommended_actions: SimulationRecommendedAction[]
  recovery_available: boolean
  recovery_plan_id: string | null
  ai_explanation: string
  ai_run_id: string | null
  mode: 'ai' | 'fallback'
  fallback_reason: AiFallbackReason | null
  created_at: string
}

type SimulationDeterministic = {
  project: ProjectDetail
  currentTasks: TaskItem[]
  projectedTasks: TaskItem[]
  inputs: GoalSimulation['inputs']
  currentScore: ExecutionScore
  projectedScore: ExecutionScore
  currentHealth: WorkspaceHealthSnapshot
  projectedHealth: WorkspaceHealthSnapshot
  timeline: TimelineProjection
  currentProbability: number
  projectedProbability: number
  criticalTasks: GoalSimulation['critical_tasks']
  recommendedActions: SimulationRecommendedAction[]
  recoveryAvailable: boolean
  recoveryPlanId: string | null
}

type SimulationContext = AiExecutionContext

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseDate(value: unknown, field: string) {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw badRequest(`${field} must be a date string`)
  const parsed = new Date(`${value.slice(0, 10)}T17:00:00`)
  if (Number.isNaN(parsed.getTime())) throw badRequest(`${field} must be a valid date`)
  return parsed
}

function optionalNumber(value: unknown, fallback: number, min: number, max: number, field: string) {
  if (value == null || value === '') return fallback
  const raw = Number(value)
  if (!Number.isFinite(raw)) throw badRequest(`${field} must be a number`)
  return clamp(raw, min, max)
}

function optionalInteger(value: unknown, fallback: number, min: number, max: number, field: string) {
  if (value == null || value === '') return fallback
  const raw = Number(value)
  if (!Number.isInteger(raw)) throw badRequest(`${field} must be an integer`)
  return clamp(raw, min, max)
}

function isOpenTask(task: TaskItem) {
  return !['done', 'cancelled'].includes(task.status)
}

function estimateMinutes(task: TaskItem) {
  return task.estimate_minutes ?? 120
}

function remainingWorkMinutes(tasks: TaskItem[]) {
  return tasks.filter(isOpenTask).reduce((total, task) => total + estimateMinutes(task), 0)
}

function remainingDaysUntil(deadline: Date, now: Date) {
  return Math.max(1, Math.ceil((deadline.getTime() - now.getTime()) / MS_PER_DAY))
}

function projectedFinishDate(now: Date, workMinutes: number, dailyCapacityMinutes: number, extraDelayDays: number) {
  const workDays = Math.max(1, Math.ceil(workMinutes / Math.max(dailyCapacityMinutes, 30)))
  return addDays(now, workDays + Math.max(0, extraDelayDays))
}

function successProbability(score: ExecutionScore, timeline: TimelineProjection) {
  const loadRatio = timeline.remaining_work_minutes / Math.max(timeline.available_minutes, 1)
  const loadPenalty = Math.min(35, Math.max(0, (loadRatio - 0.85) * 38))
  const schedulePenalty = Math.min(28, Math.max(0, timeline.schedule_delta_days) * 8)
  const overduePenalty = Math.min(24, score.metrics.overdue_tasks * 7)
  const riskPenalty = Math.min(25, score.top_risks.filter((risk) => risk.level === 'critical' || risk.level === 'high').length * 6)
  const capacityBonus = timeline.daily_capacity_minutes > DEFAULT_DAILY_HOURS * 60 ? Math.min(10, (timeline.daily_capacity_minutes - DEFAULT_DAILY_HOURS * 60) / 30) : 0
  return Math.round(clamp(score.score + 18 + capacityBonus - loadPenalty - schedulePenalty - overduePenalty - riskPenalty, 0, 100))
}

function normalizeInput(input: GoalSimulationInput, project: ProjectDetail) {
  validateRequiredUuid(input.projectId, 'project_id')
  const targetDeadline = parseDate(input.targetDeadline, 'target_deadline') ?? (project.target_deadline ? new Date(project.target_deadline) : addDays(new Date(), 7))
  const dailyWorkHours = optionalNumber(input.dailyWorkHours, DEFAULT_DAILY_HOURS, MIN_DAILY_HOURS, MAX_DAILY_HOURS, 'daily_work_hours')
  const extraDailyHours = optionalNumber(input.extraDailyHours, 0, 0, MAX_DAILY_HOURS, 'extra_daily_hours')
  const delayDays = optionalInteger(input.delayDays, 0, 0, 30, 'delay_days')
  const shiftMilestoneDays = optionalInteger(input.shiftMilestoneDays, 0, -14, 30, 'shift_milestone_days')
  const delayTaskId = validateOptionalUuid(input.delayTaskId ?? null, 'delay_task_id')

  return {
    projectId: input.projectId,
    targetDeadline: dateOnly(targetDeadline),
    dailyWorkHours,
    extraDailyHours,
    delayTaskId,
    delayDays,
    shiftMilestoneDays,
    removeCompletedTasks: Boolean(input.removeCompletedTasks),
  }
}

function applyScenario(tasks: TaskItem[], inputs: GoalSimulation['inputs']) {
  return tasks
    .filter((task) => (inputs.removeCompletedTasks ? task.status !== 'done' && task.status !== 'cancelled' : true))
    .map((task) => {
      const next = { ...task }
      if (isOpenTask(next) && next.due_at && inputs.shiftMilestoneDays !== 0) {
        next.due_at = addDays(new Date(next.due_at), inputs.shiftMilestoneDays).toISOString()
      }

      if (inputs.delayTaskId && next.id === inputs.delayTaskId && inputs.delayDays > 0) {
        const baseDate = next.due_at ? new Date(next.due_at) : new Date()
        next.due_at = addDays(baseDate, inputs.delayDays).toISOString()
        if (next.status === 'in_progress') next.status = 'todo'
      }

      return next
    })
}

function buildTimeline(tasks: TaskItem[], inputs: GoalSimulation['inputs'], now: Date) {
  const deadline = new Date(`${inputs.targetDeadline}T17:00:00`)
  const dailyCapacityMinutes = Math.round((inputs.dailyWorkHours + inputs.extraDailyHours) * 60)
  const workMinutes = remainingWorkMinutes(tasks)
  const remainingDays = remainingDaysUntil(deadline, now)
  const availableMinutes = dailyCapacityMinutes * remainingDays
  const delayedTaskDays = inputs.delayTaskId ? inputs.delayDays : 0
  const finish = projectedFinishDate(now, workMinutes, dailyCapacityMinutes, delayedTaskDays)
  const scheduleDeltaDays = Math.ceil((finish.getTime() - deadline.getTime()) / MS_PER_DAY)

  return {
    target_deadline: inputs.targetDeadline,
    estimated_finish_date: dateOnly(finish),
    remaining_work_minutes: workMinutes,
    available_minutes: availableMinutes,
    daily_capacity_minutes: dailyCapacityMinutes,
    remaining_days: remainingDays,
    projected_duration_days: Math.max(1, Math.ceil(workMinutes / Math.max(dailyCapacityMinutes, 30))),
    schedule_delta_days: scheduleDeltaDays,
  }
}

function criticalTasks(tasks: TaskItem[], now: Date) {
  return tasks
    .map((task) => ({ risk: scoreTaskRisk(task, tasks, now), task }))
    .filter((entry) => entry.risk.level === 'critical' || entry.risk.level === 'high')
    .sort((a, b) => b.risk.score - a.risk.score)
    .slice(0, 5)
    .map((entry) => ({
      ...entry.risk,
      due_at: entry.task.due_at,
      estimate_minutes: entry.task.estimate_minutes,
    }))
}

function healthChangeLabel(from: WorkspaceHealthLevel, to: WorkspaceHealthLevel) {
  if (from === to) return 'No health level change'
  const rank: Record<WorkspaceHealthLevel, number> = { critical: 0, attention: 1, healthy: 2 }
  return rank[to] > rank[from] ? 'Health improves' : 'Health deteriorates'
}

function recommendedActions(
  deterministic: Pick<SimulationDeterministic, 'project' | 'projectedScore' | 'timeline' | 'criticalTasks' | 'recoveryAvailable'>
): SimulationRecommendedAction[] {
  const actions: SimulationRecommendedAction[] = []
  const loadRatio = deterministic.timeline.remaining_work_minutes / Math.max(deterministic.timeline.available_minutes, 1)

  if (deterministic.timeline.schedule_delta_days > 0) {
    actions.push({
      type: 'move_deadline',
      label: 'Move the target deadline',
      reason: `Projected finish is ${deterministic.timeline.schedule_delta_days} day${deterministic.timeline.schedule_delta_days === 1 ? '' : 's'} after the target.`,
    })
  }

  if (loadRatio > 1) {
    actions.push({
      type: 'increase_capacity',
      label: 'Add focused capacity',
      reason: 'Remaining estimated work exceeds available work time.',
    })
  }

  const blocked = deterministic.criticalTasks.find((task) => task.factors.some((factor) => factor.key === 'task_status' && factor.reason.toLowerCase().includes('blocked')))
  if (blocked) {
    actions.push({
      type: 'unblock_task',
      label: `Unblock ${blocked.task_title}`,
      reason: blocked.explanation,
    })
  }

  if (deterministic.criticalTasks.length > 0) {
    actions.push({
      type: 'start_critical_task',
      label: `Start ${deterministic.criticalTasks[0].task_title}`,
      reason: deterministic.criticalTasks[0].explanation,
    })
  }

  if (deterministic.recoveryAvailable) {
    actions.push({
      type: 'recover_project',
      label: 'Generate a recovery plan',
      reason: 'Momentum can propose concrete recovery actions from current risk and health.',
    })
  }

  if (deterministic.projectedScore.metrics.open_tasks > 8) {
    actions.push({
      type: 'reduce_scope',
      label: 'Reduce scope before adding work',
      reason: `${deterministic.projectedScore.metrics.open_tasks} open tasks are competing for capacity.`,
    })
  }

  return actions.slice(0, 5)
}

function deterministicExplanation(result: Omit<GoalSimulation, 'id' | 'ai_explanation' | 'ai_run_id' | 'mode' | 'fallback_reason' | 'created_at'>) {
  const probabilityDelta = result.projected_state.success_probability - result.current_state.success_probability
  if (result.timeline_projection.schedule_delta_days > 0) {
    return `Momentum projects the goal will finish ${result.timeline_projection.schedule_delta_days} day${result.timeline_projection.schedule_delta_days === 1 ? '' : 's'} after the target. Success probability ${probabilityDelta >= 0 ? 'moves' : 'drops'} by ${Math.abs(probabilityDelta)} points because available capacity and critical task risk are the strongest constraints. Review recovery before committing changes.`
  }

  return `Momentum projects this goal can fit before the target date with ${result.projected_state.success_probability}% success probability. The strongest lever is ${result.recommended_actions[0]?.label.toLowerCase() ?? 'keeping the current execution flow narrow'}. Nothing changes until you choose a recovery or task action.`
}

async function buildDeterministic(input: GoalSimulationInput): Promise<SimulationDeterministic> {
  validateRequiredUuid(input.projectId, 'project_id')
  const [project, tasks, currentScore, recoveryPlans] = await Promise.all([
    getProject(input.projectId),
    listProjectTasks(input.projectId),
    getProjectExecutionScore(input.projectId),
    listRecoveryPlans(input.projectId),
  ])
  const now = new Date()
  const inputs = normalizeInput(input, project)
  const projectedTasks = applyScenario(tasks, inputs)
  const projectedScore = calculateExecutionScore(projectedTasks, { scope: 'project', projectId: input.projectId, now })
  const currentHealth = calculateWorkspaceHealth(currentScore)
  const projectedHealth = calculateWorkspaceHealth(projectedScore)
  const timeline = buildTimeline(projectedTasks, inputs, now)
  const projected = {
    project,
    projectedScore,
    timeline,
    criticalTasks: criticalTasks(projectedTasks, now),
    recoveryAvailable: recoveryPlans.length > 0 || projectedHealth.level !== 'healthy' || projectedScore.score < 70,
  }

  return {
    project,
    currentTasks: tasks,
    projectedTasks,
    inputs,
    currentScore,
    projectedScore,
    currentHealth,
    projectedHealth,
    timeline,
    currentProbability: successProbability(currentScore, buildTimeline(tasks, inputs, now)),
    projectedProbability: successProbability(projectedScore, timeline),
    criticalTasks: projected.criticalTasks,
    recommendedActions: recommendedActions(projected),
    recoveryAvailable: projected.recoveryAvailable,
    recoveryPlanId: recoveryPlans[0]?.id ?? null,
  }
}

async function buildContext(deterministic: SimulationDeterministic): Promise<SimulationContext> {
  const projectContext = await buildProjectContext({ projectId: deterministic.project.id, maxTasks: 10 })
  const summary = toPublicSimulation(deterministic)

  return {
    contextJson: JSON.stringify(
      {
        project: {
          id: deterministic.project.id,
          title: deterministic.project.title,
          target_deadline: deterministic.project.target_deadline,
        },
        simulation: summary,
      },
      null,
      2
    ),
    inputSummary: `Explain goal simulation for ${deterministic.project.title}.`,
    citations: withCitations(projectContext.sources),
  }
}

function userInstruction() {
  return 'Explain this deterministic simulation. Do not recalculate or alter any metrics.'
}

function toPublicSimulation(deterministic: SimulationDeterministic): Omit<
  GoalSimulation,
  'id' | 'ai_explanation' | 'ai_run_id' | 'mode' | 'fallback_reason' | 'created_at'
> {
  const currentState = {
    success_probability: deterministic.currentProbability,
    execution_score: deterministic.currentScore.score,
    workspace_health: deterministic.currentHealth,
    average_risk: deterministic.currentScore.metrics.average_risk,
    high_or_critical_risks: deterministic.currentScore.top_risks.filter((risk) => risk.level === 'critical' || risk.level === 'high').length,
  }
  const projectedState = {
    success_probability: deterministic.projectedProbability,
    execution_score: deterministic.projectedScore.score,
    workspace_health: deterministic.projectedHealth,
    average_risk: deterministic.projectedScore.metrics.average_risk,
    high_or_critical_risks: deterministic.projectedScore.top_risks.filter((risk) => risk.level === 'critical' || risk.level === 'high').length,
  }

  return {
    project_id: deterministic.project.id,
    scenario_name: 'Goal simulation',
    inputs: deterministic.inputs,
    current_state: currentState,
    projected_state: projectedState,
    timeline_projection: deterministic.timeline,
    execution_score_change: projectedState.execution_score - currentState.execution_score,
    risk_change: projectedState.average_risk - currentState.average_risk,
    health_change: {
      from: currentState.workspace_health.level,
      to: projectedState.workspace_health.level,
      label: healthChangeLabel(currentState.workspace_health.level, projectedState.workspace_health.level),
    },
    critical_tasks: deterministic.criticalTasks,
    recommended_actions: deterministic.recommendedActions,
    recovery_available: deterministic.recoveryAvailable,
    recovery_plan_id: deterministic.recoveryPlanId,
  }
}

async function persistSimulation(
  userId: string,
  simulation: Omit<GoalSimulation, 'id' | 'created_at'>,
  deterministic: SimulationDeterministic
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('goal_simulations')
    .insert({
      project_id: deterministic.project.id,
      created_by: userId,
      ai_run_id: simulation.ai_run_id,
      scenario_name: simulation.scenario_name,
      inputs: simulation.inputs,
      current_state: simulation.current_state,
      projected_state: simulation.projected_state,
      timeline_projection: simulation.timeline_projection,
      critical_tasks: simulation.critical_tasks,
      recommended_actions: simulation.recommended_actions,
      explanation: simulation.ai_explanation,
    })
    .select('id, created_at')
    .single()

  if (error) throw new Error(error.message)
  return data as { id: string; created_at: string }
}

export async function simulateGoal(userId: string, input: GoalSimulationInput): Promise<GoalSimulation> {
  const result = await executeAiTextCapability<SimulationDeterministic, SimulationContext>({
    userId,
    projectId: input.projectId,
    capability: 'goal_simulation',
    buildDeterministic: () => buildDeterministic(input),
    buildContext,
    buildUserInstruction: userInstruction,
    temperature: 0.35,
    maxOutputTokens: 500,
  })

  const deterministic = result.deterministic
  const publicSimulation = toPublicSimulation(deterministic)
  const explanation = result.mode === 'ai' ? result.text.trim() : deterministicExplanation(publicSimulation)
  const simulationWithoutId = {
    ...publicSimulation,
    ai_explanation: explanation,
    ai_run_id: result.mode === 'ai' ? result.run.id : null,
    mode: result.mode,
    fallback_reason: result.mode === 'fallback' ? result.reason : null,
  }
  const persisted = await persistSimulation(userId, simulationWithoutId, deterministic)

  return {
    ...simulationWithoutId,
    id: persisted.id,
    created_at: persisted.created_at,
  }
}

export async function ensureRecoveryDraft(projectId: string, userId: string) {
  validateRequiredUuid(projectId, 'project_id')
  validateRequiredUuid(userId, 'user_id')
  return buildRecoveryPlan(projectId)
}
