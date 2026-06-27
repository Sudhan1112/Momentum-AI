import 'server-only'

import { executeAiTextCapability, type AiExecutionContext } from '@/lib/momentum/ai/executor'
import { buildProjectContextFromData } from '@/lib/momentum/ai/context-builder'
import { intentionallyCitationless, withCitations } from '@/lib/momentum/ai/gateway'
import { badRequest, notFound } from '@/lib/momentum/errors'
import { buildPlannerTodayFromData } from '@/lib/momentum/planner/planner-service'
import { listProjectsForUser } from '@/lib/momentum/projects/project-service'
import { listRecoveryPlans } from '@/lib/momentum/recovery-service'
import { listProjectTasks } from '@/lib/momentum/tasks/task-service'
import { validateOptionalUuid, validateRequiredUuid } from '@/lib/momentum/validation/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayDateOnly, toDateOnly, validatePlanningDate } from '@/lib/momentum/date'
import type { ProjectDetail } from '@/types/project'
import {
  buildDeterministicExecutionPlan,
  EXECUTION_INTELLIGENCE_ENGINE,
  type ExecutionProjectInput,
  type MomentumExecutionPlan,
} from './execution-intelligence'

type ProposalRow = {
  id: string
  user_id: string
  project_id: string | null
  ai_run_id: string | null
  schedule_date: string
  version: number
  confidence: number
  input_snapshot: Record<string, unknown>
  insights: Record<string, unknown>
  explanation_summary: string | null
  created_at: string
}

type StoredPlan = Pick<
  MomentumExecutionPlan,
  | 'mode'
  | 'fallback_reason'
  | 'context'
  | 'highest_impact_action'
  | 'quick_win'
  | 'todays_focus'
  | 'ignore_today'
  | 'blockers'
  | 'daily_summary'
  | 'coach_summary'
>

type GenerateExecutionPlanInput = {
  projectId?: string | null
  scheduleDate?: string | null
}

const DEFAULT_PRODUCTIVE_MINUTES = 240

function parseScheduleDate(value?: string | null) {
  if (!value) return todayDateOnly()
  const parsed = validatePlanningDate(value, { field: 'schedule_date' })
  if (!parsed.ok) throw badRequest(parsed.message)
  return toDateOnly(parsed.value) ?? todayDateOnly()
}

async function latestSimulationProbability(projectId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('goal_simulations')
    .select('projected_state')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const probability = Number((data?.projected_state as { success_probability?: unknown } | null)?.success_probability)
  return Number.isFinite(probability) ? Math.min(100, Math.max(0, Math.round(probability))) : null
}

async function loadProjectInputs(userId: string, projectId: string | null): Promise<ExecutionProjectInput[]> {
  const available = await listProjectsForUser(userId)
  const projects = projectId
    ? available.filter((project) => project.id === projectId)
    : available.filter((project) => project.status === 'active')

  if (projectId && projects.length === 0) throw notFound('Project not found')

  return Promise.all(
    projects.map(async (project) => {
      const [tasks, recoveryPlans, simulationProbability] = await Promise.all([
        listProjectTasks(project.id),
        listRecoveryPlans(project.id),
        latestSimulationProbability(project.id),
      ])
      const activeRecovery = recoveryPlans.find((plan) => plan.status === 'proposed')
      return {
        project,
        tasks,
        recovery_actions: activeRecovery?.actions ?? [],
        simulation_probability: simulationProbability,
      }
    })
  )
}

async function productiveMinutes(userId: string, scheduleDate: string) {
  const weekday = new Date(`${scheduleDate}T09:00:00`).getDay()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_capacity_profiles')
    .select('default_minutes, learned_minutes, confidence, sample_count')
    .eq('user_id', userId)
    .eq('weekday', weekday)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return DEFAULT_PRODUCTIVE_MINUTES
  if (data.learned_minutes == null || data.sample_count < 3 || data.confidence < 40) {
    return data.default_minutes
  }
  const confidence = data.confidence / 100
  return Math.round(data.default_minutes * (1 - confidence) + data.learned_minutes * confidence)
}

function buildAiContext(
  deterministic: ReturnType<typeof buildDeterministicExecutionPlan>,
  projects: ExecutionProjectInput[]
): AiExecutionContext {
  const sources = projects.flatMap((entry) =>
    buildProjectContextFromData(
      entry.project as ProjectDetail,
      entry.tasks,
      10
    ).sources
  ).slice(0, 20)

  return {
    contextJson: JSON.stringify({
      execution_score: deterministic.context.execution_score,
      health: deterministic.context.health_label,
      momentum_score: deterministic.context.momentum_score,
      highest_impact_action: deterministic.highest_impact_action,
      quick_win: deterministic.quick_win,
      planner_brief: deterministic.context.planner_narrative,
      todays_focus: deterministic.todays_focus.map((item) => ({
        rank: item.rank,
        task: item.title,
        reason: item.reason,
        impact: item.execution_impact,
        next_best_action: item.next_best_action,
      })),
      ignore_today: deterministic.ignore_today,
      blockers: deterministic.blockers,
      daily_summary: deterministic.daily_summary,
    }),
    inputSummary: `Execution plan with ${deterministic.todays_focus.length} focus task(s), ${deterministic.blockers.length} blocker(s), and score ${deterministic.context.execution_score}.`,
    citations: sources.length > 0
      ? withCitations(sources)
      : intentionallyCitationless('No project task evidence is available for this execution plan.'),
  }
}

function aiInstruction() {
  return [
    'Write one concise coach summary for the deterministic execution plan.',
    'Do not add tasks, reorder tasks, change scores, change estimates, or invent dependencies.',
    'Refer only to the supplied focus order, blockers, and ignore-today decisions.',
    'Use plain text in at most four sentences.',
  ].join('\n')
}

async function nextVersion(userId: string, projectId: string | null, scheduleDate: string) {
  const admin = createAdminClient()
  let query = admin
    .from('momentum_flow_proposals')
    .select('version')
    .eq('user_id', userId)
    .eq('schedule_date', scheduleDate)
    .order('version', { ascending: false })
    .limit(1)
  query = projectId ? query.eq('project_id', projectId) : query.is('project_id', null)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return Number(data?.version ?? 0) + 1
}

function storedPlan(row: ProposalRow) {
  if (row.input_snapshot?.engine !== EXECUTION_INTELLIGENCE_ENGINE) return null
  const stored = row.insights?.plan
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return null
  return stored as StoredPlan
}

function rowToPlan(row: ProposalRow): MomentumExecutionPlan {
  const stored = storedPlan(row)
  if (!stored) throw new Error('Momentum Flow proposal does not contain an execution intelligence plan')
  return {
    id: row.id,
    project_id: row.project_id,
    schedule_date: row.schedule_date,
    version: row.version,
    generated_at: row.created_at,
    confidence: row.confidence,
    ai_run_id: row.ai_run_id,
    engine: EXECUTION_INTELLIGENCE_ENGINE,
    ...stored,
  }
}

export async function generateMomentumExecutionPlan(
  userId: string,
  input: GenerateExecutionPlanInput
): Promise<MomentumExecutionPlan> {
  validateRequiredUuid(userId, 'user_id')
  const projectId = validateOptionalUuid(input.projectId ?? null, 'project_id')
  const scheduleDate = parseScheduleDate(input.scheduleDate)
  const [projects, capacity] = await Promise.all([
    loadProjectInputs(userId, projectId),
    productiveMinutes(userId, scheduleDate),
  ])
  const planner = buildPlannerTodayFromData(
    projects.map(({ project, tasks }) => ({ project, tasks })),
    new Date(`${scheduleDate}T09:00:00`)
  )
  const deterministic = buildDeterministicExecutionPlan({
    projects,
    planner,
    schedule_date: scheduleDate,
    productive_minutes: capacity,
  })
  const aiResult = await executeAiTextCapability({
    userId,
    projectId,
    capability: 'momentum_flow',
    buildDeterministic: () => deterministic,
    buildContext: (plan) => buildAiContext(plan, projects),
    buildUserInstruction: aiInstruction,
    temperature: 0.2,
    maxOutputTokens: 280,
  })
  const mode = aiResult.mode
  const coachSummary = aiResult.mode === 'ai'
    ? aiResult.text.trim().slice(0, 1_500) || deterministic.coach_summary
    : deterministic.coach_summary
  const fallbackReason = aiResult.mode === 'fallback' ? aiResult.reason : null
  const aiRunId = aiResult.mode === 'ai' ? aiResult.run.id : null
  const version = await nextVersion(userId, projectId, scheduleDate)
  const plan: StoredPlan = {
    mode,
    fallback_reason: fallbackReason,
    context: deterministic.context,
    highest_impact_action: deterministic.highest_impact_action,
    quick_win: deterministic.quick_win,
    todays_focus: deterministic.todays_focus,
    ignore_today: deterministic.ignore_today,
    blockers: deterministic.blockers,
    daily_summary: deterministic.daily_summary,
    coach_summary: coachSummary,
  }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('momentum_flow_proposals')
    .insert({
      user_id: userId,
      project_id: projectId,
      ai_run_id: aiRunId,
      schedule_date: scheduleDate,
      horizon_days: 1,
      version,
      input_snapshot: {
        engine: EXECUTION_INTELLIGENCE_ENGINE,
        task_count: projects.reduce((total, entry) => total + entry.tasks.length, 0),
        project_count: projects.length,
        planner_metrics: planner.brief.metrics,
      },
      capacity_summary: {
        productive_minutes: capacity,
        selected_minutes: deterministic.context.selected_minutes,
        source: 'capacity_profile_or_default',
      },
      confidence: deterministic.confidence,
      insights: {
        engine: EXECUTION_INTELLIGENCE_ENGINE,
        plan,
      },
      backlog_remaining: {
        ignored_task_count: deterministic.ignore_today.length,
        blocker_count: deterministic.blockers.length,
      },
      explanation_summary: coachSummary,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return rowToPlan(data as ProposalRow)
}

export async function getLatestMomentumExecutionPlan(userId: string, projectIdInput?: string | null) {
  validateRequiredUuid(userId, 'user_id')
  const projectId = validateOptionalUuid(projectIdInput ?? null, 'project_id')
  const admin = createAdminClient()
  let query = admin
    .from('momentum_flow_proposals')
    .select('*')
    .eq('user_id', userId)
    .eq('schedule_date', todayDateOnly())
    .order('created_at', { ascending: false })
    .limit(10)
  query = projectId ? query.eq('project_id', projectId) : query.is('project_id', null)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const row = ((data ?? []) as ProposalRow[]).find((candidate) => storedPlan(candidate))
  return row ? rowToPlan(row) : null
}

export async function getMomentumExecutionPlan(userId: string, proposalId: string) {
  validateRequiredUuid(userId, 'user_id')
  validateRequiredUuid(proposalId, 'proposal_id')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('momentum_flow_proposals')
    .select('*')
    .eq('id', proposalId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw notFound('Execution plan not found')
  return rowToPlan(data as ProposalRow)
}

export function executionPlanExplanation(plan: MomentumExecutionPlan) {
  return {
    explanation: plan.coach_summary,
    ai_run_id: plan.ai_run_id,
    mode: plan.mode,
    fallback_reason: plan.fallback_reason,
  }
}
