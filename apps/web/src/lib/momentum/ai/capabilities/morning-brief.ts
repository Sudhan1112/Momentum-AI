import 'server-only'

import { executeAiJsonCapability, type AiExecutionContext, type AiFallbackReason } from '@/lib/momentum/ai/executor'
import { intentionallyCitationless, withCitations } from '@/lib/momentum/ai/gateway'
import { buildProjectContext, serializeAiContext } from '@/lib/momentum/ai/context-builder'
import { getWorkspaceExecutionScore, type WorkspaceExecutionScore } from '@/lib/momentum/execution-score'
import { calculateWorkspaceHealth, type WorkspaceHealthSnapshot } from '@/lib/momentum/health-snapshot'
import { getPlannerToday, type PlannerTask, type PlannerToday } from '@/lib/momentum/planner/planner-service'
import { createAdminClient } from '@/lib/supabase/admin'

type BriefTask = {
  id: string
  project_id: string
  title: string
  project_title: string
  reason: string
  due_at: string | null
  priority: PlannerTask['priority']
}

type BriefRisk = {
  task_id: string
  project_id: string
  task_title: string
  project_title?: string
  level: string
  score: number
  reason: string
}

type MomentumRecommendationJson = {
  recommendation?: string
  reasoning?: string
}

type MorningBriefDeterministic = {
  user_name: string
  planner: PlannerToday
  execution_score: WorkspaceExecutionScore
  health: WorkspaceHealthSnapshot
  welcome: string
  top_priorities: BriefTask[]
  at_risk_tasks: BriefRisk[]
  blockers: BriefTask[]
  todays_plan: BriefTask[]
  deterministic_recommendation: {
    recommendation: string
    reasoning: string
  }
}

type MorningBriefContext = AiExecutionContext

export type MomentumDailyBrief = {
  generated_at: string
  mode: 'ai' | 'fallback'
  fallback_reason: AiFallbackReason | 'no_workspace_data' | null
  ai_run_id: string | null
  welcome: string
  execution_score: {
    score: number
    explanation: string
  }
  workspace_health: {
    level: WorkspaceHealthSnapshot['level']
    label: WorkspaceHealthSnapshot['label']
    reasons: string[]
  }
  metrics: PlannerToday['brief']['metrics']
  top_priorities: BriefTask[]
  at_risk_tasks: BriefRisk[]
  blockers: BriefTask[]
  todays_plan: BriefTask[]
  recommendation: {
    title: 'Momentum Suggests'
    summary: string
    reasoning: string
  }
  citations: Array<{
    source_type: string
    source_id: string
    excerpt: string | null
  }>
}

const ATTENTION_ORDER: Record<string, number> = {
  overdue: 0,
  blocked: 1,
  due_today: 2,
  clear: 3,
}

function firstNameFromProfile(profile: { full_name?: string | null; email?: string | null } | null) {
  const name = profile?.full_name?.trim() || profile?.email?.split('@')[0] || 'there'
  return name.split(/\s+/)[0] || 'there'
}

async function getUserName(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('full_name, email').eq('id', userId).maybeSingle()
  return firstNameFromProfile(data)
}

function taskReason(task: PlannerTask) {
  if (task.blocked_reason) return `Blocked: ${task.blocked_reason}`
  if (task.is_overdue) return 'Overdue and still open.'
  if (task.is_due_today) return 'Due today.'
  if (task.status === 'in_progress') return 'Already in progress.'
  return `${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority.`
}

function toBriefTask(task: PlannerTask): BriefTask {
  return {
    id: task.id,
    project_id: task.project_id,
    title: task.title,
    project_title: task.project_title,
    reason: taskReason(task),
    due_at: task.due_at,
    priority: task.priority,
  }
}

function uniqueTasks(tasks: PlannerTask[], max: number) {
  const seen = new Set<string>()
  const selected: BriefTask[] = []

  for (const task of tasks) {
    if (seen.has(task.id)) continue
    seen.add(task.id)
    selected.push(toBriefTask(task))
    if (selected.length >= max) break
  }

  return selected
}

function buildTopPriorities(planner: PlannerToday) {
  return uniqueTasks(
    [
      ...(planner.next_action ? [planner.next_action] : []),
      ...planner.sections.overdue,
      ...planner.sections.due_today,
      ...planner.sections.in_progress,
    ],
    3
  )
}

function buildTodaysPlan(planner: PlannerToday) {
  return uniqueTasks([...planner.sections.overdue, ...planner.sections.due_today, ...planner.sections.in_progress], 5)
}

function buildRisks(score: WorkspaceExecutionScore): BriefRisk[] {
  return score.top_risks
    .filter((risk) => risk.score > 0.3)
    .slice(0, 3)
    .map((risk) => ({
      task_id: risk.task_id,
      project_id: risk.project_id,
      task_title: risk.task_title,
      project_title: risk.project_title,
      level: risk.level,
      score: risk.score_100,
      reason: risk.factors
        .filter((factor) => factor.contribution > 0)
        .sort((a, b) => b.contribution - a.contribution)[0]?.reason ?? risk.explanation,
    }))
}

function deterministicRecommendation(input: {
  planner: PlannerToday
  health: WorkspaceHealthSnapshot
  topPriorities: BriefTask[]
  blockers: BriefTask[]
  risks: BriefRisk[]
}) {
  if (input.planner.brief.metrics.active_projects === 0) {
    return {
      recommendation: "Create one active project and add three tasks so Momentum can guide today's execution.",
      reasoning: 'Momentum needs project and task data before it can prioritize work.',
    }
  }

  if (input.blockers.length > 0) {
    return {
      recommendation: `Unblock ${input.blockers[0].title} before starting new work.`,
      reasoning: `${input.blockers[0].title} is blocking progress in ${input.blockers[0].project_title}.`,
    }
  }

  if (input.planner.brief.metrics.overdue > 0) {
    return {
      recommendation: `Clear ${input.planner.brief.metrics.overdue} overdue task${input.planner.brief.metrics.overdue === 1 ? '' : 's'} before switching context.`,
      reasoning: 'Overdue work is the fastest way to improve workspace health and execution score.',
    }
  }

  if (input.risks.length > 0) {
    return {
      recommendation: `Stabilize ${input.risks[0].task_title} today.`,
      reasoning: input.risks[0].reason,
    }
  }

  if (input.topPriorities.length > 0) {
    return {
      recommendation: `Start with ${input.topPriorities[0].title}.`,
      reasoning: `${input.topPriorities[0].title} is the clearest next action for maintaining momentum.`,
    }
  }

  return {
    recommendation: 'Use today to move one active project forward.',
    reasoning: input.health.reasons[0] ?? 'Workspace pressure is low, so a focused next action is enough.',
  }
}

async function buildDeterministicBrief(userId: string): Promise<MorningBriefDeterministic> {
  const [userName, planner, executionScore] = await Promise.all([
    getUserName(userId),
    getPlannerToday(userId),
    getWorkspaceExecutionScore(userId),
  ])
  const health = calculateWorkspaceHealth(executionScore)
  const topPriorities = buildTopPriorities(planner)
  const blockers = uniqueTasks(planner.sections.blocked, 3)
  const atRiskTasks = buildRisks(executionScore)
  const todaysPlan = buildTodaysPlan(planner)

  return {
    user_name: userName,
    planner,
    execution_score: executionScore,
    health,
    welcome: `Good morning, ${userName}`,
    top_priorities: topPriorities,
    at_risk_tasks: atRiskTasks,
    blockers,
    todays_plan: todaysPlan,
    deterministic_recommendation: deterministicRecommendation({
      planner,
      health,
      topPriorities,
      blockers,
      risks: atRiskTasks,
    }),
  }
}

async function buildBriefContext(deterministic: MorningBriefDeterministic): Promise<MorningBriefContext> {
  const projectIds = deterministic.planner.projects
    .slice()
    .sort((a, b) => (ATTENTION_ORDER[a.attention] ?? 9) - (ATTENTION_ORDER[b.attention] ?? 9))
    .slice(0, 3)
    .map((project) => project.id)

  const projectContexts = await Promise.all(projectIds.map((projectId) => buildProjectContext({ projectId, maxTasks: 8 })))
  const citationItems = projectContexts.flatMap((context) => context.sources)
  const contextJson = serializeAiContext({
    kind: 'project',
    project: {
      id: 'workspace',
      title: 'Momentum workspace',
      status: 'active',
      target_deadline: null,
      goal_summary: 'Daily execution brief across active projects.',
      execution_target_score: null,
    },
    tasks: projectContexts.flatMap((context) => context.tasks).slice(0, 16),
    sources: citationItems,
    citations: citationItems.length > 0 ? withCitations(citationItems) : intentionallyCitationless('No project context is available yet.'),
    summary: JSON.stringify({
      welcome: deterministic.welcome,
      execution_score: deterministic.execution_score.score,
      workspace_health: deterministic.health.label,
      health_reasons: deterministic.health.reasons,
      metrics: deterministic.planner.brief.metrics,
      top_priorities: deterministic.top_priorities,
      at_risk_tasks: deterministic.at_risk_tasks,
      blockers: deterministic.blockers,
      deterministic_recommendation: deterministic.deterministic_recommendation,
    }),
  })

  return {
    contextJson,
    inputSummary: `${deterministic.welcome}: score ${deterministic.execution_score.score}, health ${deterministic.health.label}, ${deterministic.planner.brief.metrics.overdue} overdue task(s).`,
    citations: citationItems.length > 0 ? withCitations(citationItems) : intentionallyCitationless('No project context is available yet.'),
  }
}

function buildUserInstruction() {
  return [
    'Write the Momentum Suggests recommendation for today.',
    'Use the deterministic brief facts and cited project/task context.',
    'Return JSON only: {"recommendation":"...","reasoning":"..."}',
  ].join('\n')
}

function normalizeRecommendation(
  json: MomentumRecommendationJson | null,
  fallback: MorningBriefDeterministic['deterministic_recommendation']
) {
  const recommendation = typeof json?.recommendation === 'string' ? json.recommendation.trim() : ''
  const reasoning = typeof json?.reasoning === 'string' ? json.reasoning.trim() : ''

  return {
    recommendation: recommendation || fallback.recommendation,
    reasoning: reasoning || fallback.reasoning,
  }
}

function toResponse(
  deterministic: MorningBriefDeterministic,
  options: {
    mode: MomentumDailyBrief['mode']
    fallbackReason: MomentumDailyBrief['fallback_reason']
    aiRunId: string | null
    recommendation: MorningBriefDeterministic['deterministic_recommendation']
    citations: MorningBriefContext['citations']['items']
  }
): MomentumDailyBrief {
  return {
    generated_at: new Date().toISOString(),
    mode: options.mode,
    fallback_reason: options.fallbackReason,
    ai_run_id: options.aiRunId,
    welcome: deterministic.welcome,
    execution_score: {
      score: deterministic.execution_score.score,
      explanation: deterministic.execution_score.explanation,
    },
    workspace_health: {
      level: deterministic.health.level,
      label: deterministic.health.label,
      reasons: deterministic.health.reasons,
    },
    metrics: deterministic.planner.brief.metrics,
    top_priorities: deterministic.top_priorities,
    at_risk_tasks: deterministic.at_risk_tasks,
    blockers: deterministic.blockers,
    todays_plan: deterministic.todays_plan,
    recommendation: {
      title: 'Momentum Suggests',
      summary: options.recommendation.recommendation,
      reasoning: options.recommendation.reasoning,
    },
    citations: options.citations.map((citation) => ({
      source_type: citation.sourceType,
      source_id: citation.sourceId,
      excerpt: citation.excerpt ?? null,
    })),
  }
}

export async function getMomentumDailyBrief(userId: string): Promise<MomentumDailyBrief> {
  const result = await executeAiJsonCapability<MomentumRecommendationJson, MorningBriefDeterministic, MorningBriefContext>({
    userId,
    capability: 'morning_brief',
    buildDeterministic: () => buildDeterministicBrief(userId),
    buildContext: buildBriefContext,
    buildUserInstruction,
    temperature: 0.35,
    maxOutputTokens: 320,
    schemaName: 'MomentumDailyBriefRecommendation',
  })

  if (result.mode === 'fallback') {
    return toResponse(result.deterministic, {
      mode: 'fallback',
      fallbackReason:
        result.deterministic.planner.brief.metrics.active_projects === 0 ? 'no_workspace_data' : result.reason,
      aiRunId: null,
      recommendation: result.deterministic.deterministic_recommendation,
      citations: result.context.citations.items,
    })
  }

  return toResponse(result.deterministic, {
    mode: 'ai',
    fallbackReason: null,
    aiRunId: result.run.id,
    recommendation: normalizeRecommendation(result.json, result.deterministic.deterministic_recommendation),
    citations: result.context.citations.items,
  })
}
