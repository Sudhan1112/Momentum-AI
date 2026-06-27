import { calculateExecutionScore, type ExecutionScore } from '@/lib/momentum/execution-score'
import { calculateWorkspaceHealth, type WorkspaceHealthSnapshot } from '@/lib/momentum/health-snapshot'
import type { PlannerToday } from '@/lib/momentum/planner/planner-service'
import type { RecoveryAction } from '@/lib/momentum/recovery-service'
import { scoreTaskRisk, type RiskLevel, type TaskRiskScore } from '@/lib/momentum/risk-scorer'
import { calendarDayDifference, isOverdueTimestamp, timestampMs } from '@/lib/momentum/date'
import type { ProjectListItem } from '@/types/project'
import type { TaskItem, TaskPriority } from '@/types/task'
import type { AiFallbackReason } from '@/lib/momentum/ai/executor'

export const EXECUTION_INTELLIGENCE_ENGINE = 'execution_intelligence_v1'

export type ExecutionImpact = 'low' | 'medium' | 'high' | 'critical'

export type ExecutionFocusItem = {
  rank: number
  task_id: string
  project_id: string
  project_title: string
  title: string
  estimated_minutes: number
  estimate_source: 'task' | 'default'
  execution_impact: ExecutionImpact
  expected_score_improvement: number
  score: number
  risk_level: RiskLevel
  status: TaskItem['status']
  due_at: string | null
  reason: string
  next_best_action: string
}

export type ExecutionIgnoreItem = {
  task_id: string
  project_id: string
  project_title: string
  title: string
  reason: string
  score: number
  due_at: string | null
}

export type ExecutionBlocker = {
  task_id: string
  project_id: string
  project_title: string
  title: string
  why_it_matters: string
  unblock_action: string
  expected_execution_improvement: number
}

export type ExecutionPlanContext = {
  execution_score: number
  health_level: WorkspaceHealthSnapshot['level']
  health_label: WorkspaceHealthSnapshot['label']
  momentum_score: number
  momentum_label: 'low' | 'medium' | 'high'
  productive_minutes: number
  selected_minutes: number
  open_tasks: number
  overdue_tasks: number
  blocked_tasks: number
  recovery_actions_considered: number
  simulation_probability: number | null
  planner_headline: string
  planner_narrative: string
}

export type ExecutionHeroAction = {
  task_id: string
  project_id: string
  project_title: string
  title: string
  estimated_minutes: number
  expected_score_improvement: number
  reason: string
}

export type ExecutionQuickWin = {
  task_id: string
  project_id: string
  project_title: string
  title: string
  estimated_minutes: number
  expected_score_improvement: number
  reason: string
}

export type MomentumExecutionPlan = {
  id: string
  project_id: string | null
  schedule_date: string
  version: number
  generated_at: string
  confidence: number
  mode: 'ai' | 'fallback'
  fallback_reason: AiFallbackReason | null
  ai_run_id: string | null
  engine: typeof EXECUTION_INTELLIGENCE_ENGINE
  context: ExecutionPlanContext
  highest_impact_action: ExecutionHeroAction | null
  quick_win: ExecutionQuickWin | null
  todays_focus: ExecutionFocusItem[]
  ignore_today: ExecutionIgnoreItem[]
  blockers: ExecutionBlocker[]
  daily_summary: string[]
  coach_summary: string
}

export type ExecutionProjectInput = {
  project: ProjectListItem
  tasks: TaskItem[]
  recovery_actions: RecoveryAction[]
  simulation_probability: number | null
}

export type BuildExecutionPlanInput = {
  projects: ExecutionProjectInput[]
  planner: PlannerToday
  schedule_date: string
  productive_minutes: number
}

type Candidate = {
  task: TaskItem
  project: ProjectListItem
  risk: TaskRiskScore
  score: number
  impact: number
  recovery: boolean
  simulationPressure: number
  dueDays: number | null
  reason: string
}

const OPEN_STATUSES = new Set(['backlog', 'todo', 'in_progress', 'blocked'])
const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  low: 6,
  medium: 13,
  high: 21,
  urgent: 30,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function estimate(task: TaskItem) {
  return {
    minutes: task.estimate_minutes && task.estimate_minutes > 0 ? task.estimate_minutes : 60,
    source: task.estimate_minutes && task.estimate_minutes > 0 ? ('task' as const) : ('default' as const),
  }
}

function duePressure(days: number | null) {
  if (days == null) return 2
  if (days < 0) return 30
  if (days === 0) return 27
  if (days <= 2) return 22
  if (days <= 7) return 12
  return 3
}

function impactLabel(value: number, score: number): ExecutionImpact {
  if (value >= 8 || score >= 85) return 'critical'
  if (value >= 5 || score >= 70) return 'high'
  if (value >= 2 || score >= 50) return 'medium'
  return 'low'
}

function projectedCompletionImpact(task: TaskItem, tasks: TaskItem[], current: ExecutionScore, now: Date) {
  const projected = tasks.map((item) =>
    item.id === task.id
      ? { ...item, status: 'done' as const, completed_at: now.toISOString(), blocked_reason: null, blocked_at: null }
      : item
  )
  return Math.max(
    0,
    calculateExecutionScore(projected, {
      scope: 'project',
      projectId: task.project_id,
      now,
    }).score - current.score
  )
}

function projectedUnblockImpact(task: TaskItem, tasks: TaskItem[], current: ExecutionScore, now: Date) {
  const projected = tasks.map((item) =>
    item.id === task.id
      ? {
          ...item,
          status: 'in_progress' as const,
          blocked_reason: null,
          blocked_at: null,
          started_at: item.started_at ?? now.toISOString(),
        }
      : item
  )
  return Math.max(
    0,
    calculateExecutionScore(projected, {
      scope: 'project',
      projectId: task.project_id,
      now,
    }).score - current.score
  )
}

function strongestRiskReason(risk: TaskRiskScore) {
  return [...risk.factors]
    .filter((factor) => factor.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)[0]?.reason
}

function candidateReason(candidate: Omit<Candidate, 'reason'>) {
  if (candidate.dueDays != null && candidate.dueDays < 0) {
    return `Overdue by ${Math.abs(candidate.dueDays)} day${Math.abs(candidate.dueDays) === 1 ? '' : 's'} and currently ${candidate.risk.level} risk.`
  }
  if (candidate.dueDays === 0) return `Due today with ${candidate.risk.level} execution risk.`
  if (candidate.recovery) return 'An active recovery recommendation identifies this task as material to restoring momentum.'
  if (candidate.impact > 0) {
    return `Completing it is projected to improve the project execution score by ${candidate.impact} point${candidate.impact === 1 ? '' : 's'}.`
  }
  if (candidate.task.status === 'in_progress') return 'Already in progress, so finishing it avoids another context switch.'
  return strongestRiskReason(candidate.risk) ?? `${candidate.task.priority} priority work has the strongest remaining execution value.`
}

function confidenceFor(candidates: Candidate[], projects: ExecutionProjectInput[]) {
  if (candidates.length === 0) return 100
  const estimateCoverage = candidates.filter((candidate) => candidate.task.estimate_minutes != null).length / candidates.length
  const dueCoverage = candidates.filter((candidate) => candidate.task.due_at != null).length / candidates.length
  const contextCoverage = projects.filter(
    (entry) => entry.recovery_actions.length > 0 || entry.simulation_probability != null
  ).length / Math.max(1, projects.length)
  return Math.round(clamp(55 + estimateCoverage * 20 + dueCoverage * 15 + contextCoverage * 10, 55, 98))
}

function momentumLabel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 75) return 'high'
  if (score >= 55) return 'medium'
  return 'low'
}

function buildMomentumScore(input: {
  focusCount: number
  productiveMinutes: number
  selectedMinutes: number
  confidence: number
  executionScore: number
  blockedCount: number
  overdueCount: number
}) {
  if (input.focusCount === 0) return 100
  const capacityFit =
    input.productiveMinutes <= 0 ? 100 : clamp(100 - Math.max(0, input.selectedMinutes - input.productiveMinutes) * 0.5, 40, 100)
  return Math.round(
    clamp(
      input.executionScore * 0.3 +
        input.confidence * 0.35 +
        capacityFit * 0.25 -
        input.blockedCount * 4 -
        input.overdueCount * 3,
      0,
      100
    )
  )
}

function safeToWaitReason(candidate: Candidate) {
  if (candidate.task.priority === 'low') {
    return 'Low impact today. No recovery pressure, no blocker dependency, and higher-value work is ahead of it.'
  }
  if (candidate.dueDays != null && candidate.dueDays > 7) {
    return `Deadline is ${candidate.dueDays} days away, so it can wait while nearer-term work carries more execution value.`
  }
  if (candidate.task.due_at == null && candidate.risk.level === 'low') {
    return 'No near-term deadline, low current execution risk, and no signal that delaying it today creates downside.'
  }
  return null
}

function deterministicSummary(focus: ExecutionFocusItem[], blockers: ExecutionBlocker[], ignored: ExecutionIgnoreItem[]) {
  const summary: string[] = []
  if (focus[0]) summary.push(`Complete ${focus[0].title} first.`)
  if (focus[1]) summary.push(`Move to ${focus[1].title} second.`)
  if (blockers[0]) summary.push(`Resolve the blocker on ${blockers[0].title}.`)
  if (ignored[0]) summary.push(`Let ${ignored[0].title} wait today.`)
  if (summary.length === 0) summary.push('No open work needs execution guidance today.')
  return summary
}

export function buildDeterministicExecutionPlan(input: BuildExecutionPlanInput) {
  const now = new Date(`${input.schedule_date}T09:00:00`)
  const plannerNextId = input.planner.next_action?.id ?? null
  const projectScores = new Map<string, ExecutionScore>()
  const recoveryIds = new Set<string>()
  const candidates: Candidate[] = []

  for (const entry of input.projects) {
    const currentScore = calculateExecutionScore(entry.tasks, {
      scope: 'project',
      projectId: entry.project.id,
      now,
    })
    projectScores.set(entry.project.id, currentScore)
    entry.recovery_actions.forEach((action) => recoveryIds.add(action.task_id))

    for (const task of entry.tasks.filter((item) => OPEN_STATUSES.has(item.status) && item.status !== 'blocked')) {
      const risk = scoreTaskRisk(task, entry.tasks, now)
      const dueDays = task.due_at ? calendarDayDifference(input.schedule_date, task.due_at) : null
      const impact = projectedCompletionImpact(task, entry.tasks, currentScore, now)
      const recovery = recoveryIds.has(task.id)
      const simulationPressure =
        entry.simulation_probability == null ? 0 : entry.simulation_probability < 45 ? 10 : entry.simulation_probability < 65 ? 6 : 0
      const base = {
        task,
        project: entry.project,
        risk,
        impact,
        recovery,
        simulationPressure,
        dueDays,
        score: clamp(
          PRIORITY_WEIGHT[task.priority] +
            duePressure(dueDays) +
            Math.round(risk.score_100 * 0.25) +
            Math.min(20, impact * 2) +
            (recovery ? 10 : 0) +
            simulationPressure +
            (task.status === 'in_progress' ? 7 : 0) +
            (task.id === plannerNextId ? 5 : 0),
          0,
          100
        ),
      }
      candidates.push({ ...base, reason: candidateReason(base) })
    }
  }

  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      timestampMs(a.task.due_at) - timestampMs(b.task.due_at) ||
      a.task.title.localeCompare(b.task.title)
  )

  const selected: Candidate[] = []
  let selectedMinutes = 0
  for (const candidate of candidates) {
    if (selected.length >= 5) break
    const effort = estimate(candidate.task).minutes
    if (selected.length >= 1 && selectedMinutes + effort > input.productive_minutes) continue
    selected.push(candidate)
    selectedMinutes += effort
  }

  const todaysFocus: ExecutionFocusItem[] = selected.map((candidate, index) => {
    const effort = estimate(candidate.task)
    const next = selected[index + 1]
    return {
      rank: index + 1,
      task_id: candidate.task.id,
      project_id: candidate.project.id,
      project_title: candidate.project.title,
      title: candidate.task.title,
      estimated_minutes: effort.minutes,
      estimate_source: effort.source,
      execution_impact: impactLabel(candidate.impact, candidate.score),
      expected_score_improvement: candidate.impact,
      score: candidate.score,
      risk_level: candidate.risk.level,
      status: candidate.task.status,
      due_at: candidate.task.due_at,
      reason: candidate.reason,
      next_best_action: next
        ? `Move directly to ${next.task.title}.`
        : 'Regenerate the plan after completing this task to reassess current pressure.',
    }
  })

  const highestImpactAction: ExecutionHeroAction | null = todaysFocus[0]
    ? {
        task_id: todaysFocus[0].task_id,
        project_id: todaysFocus[0].project_id,
        project_title: todaysFocus[0].project_title,
        title: todaysFocus[0].title,
        estimated_minutes: todaysFocus[0].estimated_minutes,
        expected_score_improvement: todaysFocus[0].expected_score_improvement,
        reason: todaysFocus[0].reason,
      }
    : null

  const selectedIds = new Set(selected.map((candidate) => candidate.task.id))
  const ignoreToday: ExecutionIgnoreItem[] = candidates
    .filter((candidate) => !selectedIds.has(candidate.task.id))
    .flatMap((candidate) => {
      const reason = safeToWaitReason(candidate)
      return reason
        ? [
            {
              task_id: candidate.task.id,
              project_id: candidate.project.id,
              project_title: candidate.project.title,
              title: candidate.task.title,
              reason,
              score: candidate.score,
              due_at: candidate.task.due_at,
            },
          ]
        : []
    })
    .slice(0, 5)

  const quickWinCandidate =
    candidates.find((candidate) => !selectedIds.has(candidate.task.id) && estimate(candidate.task).minutes <= 30) ??
    candidates.find((candidate) => estimate(candidate.task).minutes <= 30) ??
    candidates.find((candidate) => !selectedIds.has(candidate.task.id) && estimate(candidate.task).minutes <= 45) ??
    candidates.find((candidate) => estimate(candidate.task).minutes <= 45) ??
    null

  const quickWin: ExecutionQuickWin | null = quickWinCandidate
    ? {
        task_id: quickWinCandidate.task.id,
        project_id: quickWinCandidate.project.id,
        project_title: quickWinCandidate.project.title,
        title: quickWinCandidate.task.title,
        estimated_minutes: estimate(quickWinCandidate.task).minutes,
        expected_score_improvement: quickWinCandidate.impact,
        reason:
          estimate(quickWinCandidate.task).minutes <= 30
            ? 'If time is tight, this is the shortest meaningful action with real execution value.'
            : 'If you do not have a full session, this is the smallest meaningful action worth taking first.',
      }
    : null

  const blockers: ExecutionBlocker[] = input.projects
    .flatMap((entry) => {
      const currentScore = projectScores.get(entry.project.id)!
      return entry.tasks
        .filter((task) => task.status === 'blocked')
        .map((task) => ({
          task_id: task.id,
          project_id: entry.project.id,
          project_title: entry.project.title,
          title: task.title,
          why_it_matters: task.blocked_reason
            ? `Work cannot advance while this remains blocked: ${task.blocked_reason}`
            : 'This task cannot advance and is adding inactive work to the project.',
          unblock_action: task.blocked_reason
            ? `Resolve or clarify "${task.blocked_reason}", then return the task to active work.`
            : 'Identify the missing decision, dependency, or owner, then return the task to active work.',
          expected_execution_improvement: projectedUnblockImpact(task, entry.tasks, currentScore, now),
          risk: scoreTaskRisk(task, entry.tasks, now).score_100,
        }))
    })
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 5)
    .map((blocker) => ({
      task_id: blocker.task_id,
      project_id: blocker.project_id,
      project_title: blocker.project_title,
      title: blocker.title,
      why_it_matters: blocker.why_it_matters,
      unblock_action: blocker.unblock_action,
      expected_execution_improvement: blocker.expected_execution_improvement,
    }))

  const allTasks = input.projects.flatMap((entry) => entry.tasks)
  const workspaceScore = calculateExecutionScore(allTasks, {
    scope: input.projects.length === 1 ? 'project' : 'workspace',
    projectId: input.projects.length === 1 ? input.projects[0].project.id : null,
    now,
  })
  const health = calculateWorkspaceHealth(workspaceScore)
  const overdueTasks = allTasks.filter((task) => OPEN_STATUSES.has(task.status) && isOverdueTimestamp(task.due_at, now)).length
  const simulationValues = input.projects
    .map((entry) => entry.simulation_probability)
    .filter((value): value is number => value != null)
  const confidence = confidenceFor(candidates, input.projects)
  const momentumScore = buildMomentumScore({
    focusCount: todaysFocus.length,
    productiveMinutes: input.productive_minutes,
    selectedMinutes,
    confidence,
    executionScore: workspaceScore.score,
    blockedCount: blockers.length,
    overdueCount: overdueTasks,
  })
  const context: ExecutionPlanContext = {
    execution_score: workspaceScore.score,
    health_level: health.level,
    health_label: health.label,
    momentum_score: momentumScore,
    momentum_label: momentumLabel(momentumScore),
    productive_minutes: input.productive_minutes,
    selected_minutes: selectedMinutes,
    open_tasks: allTasks.filter((task) => OPEN_STATUSES.has(task.status)).length,
    overdue_tasks: overdueTasks,
    blocked_tasks: blockers.length,
    recovery_actions_considered: input.projects.reduce((total, entry) => total + entry.recovery_actions.length, 0),
    simulation_probability:
      simulationValues.length === 0
        ? null
        : Math.round(simulationValues.reduce((total, value) => total + value, 0) / simulationValues.length),
    planner_headline: input.planner.brief.headline,
    planner_narrative: input.planner.brief.narrative,
  }

  return {
    confidence,
    context,
    highest_impact_action: highestImpactAction,
    quick_win: quickWin,
    todays_focus: todaysFocus,
    ignore_today: ignoreToday,
    blockers,
    daily_summary: deterministicSummary(todaysFocus, blockers, ignoreToday),
    coach_summary: context.planner_narrative,
  }
}
