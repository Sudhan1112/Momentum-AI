import 'server-only'

import { executeAiJsonCapability, type AiExecutionContext, type AiFallbackReason } from '@/lib/momentum/ai/executor'
import { buildProjectContextFromData } from '@/lib/momentum/ai/context-builder'
import { withCitations } from '@/lib/momentum/ai/gateway'
import { badRequest } from '@/lib/momentum/errors'
import { listProjectTasks } from '@/lib/momentum/tasks/task-service'
import { validateRequiredUuid } from '@/lib/momentum/validation/schemas'
import type { TaskItem, TaskPriority } from '@/types/task'
import type { ProjectDetail } from '@/types/project'
import { getProject } from '@/lib/momentum/projects/project-service'
import {
  cleanProposalText,
  cleanProposalTitle,
  normalizeProposalDate,
  normalizeProposalKey,
} from '@/lib/momentum/ai/proposal-normalization'

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
const MAX_GOAL_LENGTH = 2_000
const MAX_MILESTONES = 5
const MAX_TASKS_PER_MILESTONE = 5
const MAX_TOTAL_TASKS = 16

export type WorkBreakdownTaskProposal = {
  title: string
  description: string | null
  priority: TaskPriority
  due_date: string | null
  estimate_minutes: number | null
  confidence: number
  source: 'ai' | 'deterministic'
}

export type WorkBreakdownMilestoneProposal = {
  title: string
  objective: string | null
  tasks: WorkBreakdownTaskProposal[]
}

export type WorkBreakdownInput = {
  goal: string
  projectId: string
}

export type WorkBreakdownResult = {
  milestones: WorkBreakdownMilestoneProposal[]
  mode: 'ai' | 'fallback'
  fallback_reason: AiFallbackReason | 'no_valid_ai_proposals' | null
  ai_run_id: string | null
  rejected_count: number
  citations: Array<{
    source_type: string
    source_id: string
    excerpt: string | null
  }>
}

type WorkBreakdownDeterministic = {
  goal: string
  project_id: string
  existing_titles: string[]
  project_deadline: string | null
  project: ProjectDetail
  tasks: TaskItem[]
  fallback_milestones: WorkBreakdownMilestoneProposal[]
}

type WorkBreakdownContext = AiExecutionContext

type AiTaskProposal = {
  title?: unknown
  description?: unknown
  priority?: unknown
  due_date?: unknown
  estimate_minutes?: unknown
  confidence?: unknown
}

type AiMilestoneProposal = {
  title?: unknown
  objective?: unknown
  tasks?: unknown
}

type AiWorkBreakdownJson =
  | {
      milestones?: AiMilestoneProposal[]
    }
  | AiMilestoneProposal[]

function normalizeTitle(value: string) {
  return normalizeProposalKey(value)
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null
  return cleanProposalText(value, maxLength)
}

function cleanTitle(value: unknown, fallback = 'Execution step') {
  return cleanProposalTitle(value, /^(milestone|task|step)\s*\d*\s*[:,-]?\s*/i) ?? fallback
}

function normalizePriority(value: unknown, text = ''): TaskPriority {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (PRIORITIES.includes(normalized as TaskPriority)) return normalized as TaskPriority
  }

  const signal = text.toLowerCase()
  if (/\b(urgent|launch|deadline|critical|blocker)\b/.test(signal)) return 'urgent'
  if (/\b(deploy|integrate|test|fix|review|risk)\b/.test(signal)) return 'high'
  if (/\b(optional|polish|nice to have|later)\b/.test(signal)) return 'low'
  return 'medium'
}

function normalizeDueDate(value: unknown, maxDate: string | null) {
  return normalizeProposalDate(value, { maxDate })
}

function normalizeEstimate(value: unknown) {
  const raw = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(raw) || raw <= 0) return null
  return Math.min(2_400, Math.max(15, Math.round(raw / 15) * 15))
}

function normalizeConfidence(value: unknown, fallback: number) {
  const raw = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(raw)) return fallback
  const normalized = raw > 1 ? raw / 100 : raw
  return Math.round(Math.min(1, Math.max(0, normalized)) * 100) / 100
}

function fallbackMilestones(goal: string, existingTitles: string[]): WorkBreakdownMilestoneProposal[] {
  const existing = new Set(existingTitles.map(normalizeTitle))
  const goalLabel = goal.length > 90 ? `${goal.slice(0, 87)}...` : goal
  const candidates: WorkBreakdownMilestoneProposal[] = [
    {
      title: 'Define the execution path',
      objective: `Clarify what must be true to complete: ${goalLabel}`,
      tasks: [
        {
          title: 'Confirm success criteria',
          description: `Define the acceptance criteria for ${goalLabel}.`,
          priority: 'high',
          due_date: null,
          estimate_minutes: 45,
          confidence: 0.72,
          source: 'deterministic',
        },
        {
          title: 'List required dependencies',
          description: 'Identify inputs, owners, systems, and blockers before execution starts.',
          priority: 'medium',
          due_date: null,
          estimate_minutes: 45,
          confidence: 0.68,
          source: 'deterministic',
        },
      ],
    },
    {
      title: 'Build and validate',
      objective: 'Complete the core work and prove it behaves correctly.',
      tasks: [
        {
          title: 'Implement the core deliverable',
          description: `Build the main work required for ${goalLabel}.`,
          priority: 'high',
          due_date: null,
          estimate_minutes: 120,
          confidence: 0.7,
          source: 'deterministic',
        },
        {
          title: 'Validate the result end to end',
          description: 'Run the checks and manual workflow needed before calling the goal complete.',
          priority: 'high',
          due_date: null,
          estimate_minutes: 60,
          confidence: 0.7,
          source: 'deterministic',
        },
      ],
    },
  ]

  const filtered = candidates
    .map((milestone) => ({
      ...milestone,
      tasks: milestone.tasks.filter((task) => !existing.has(normalizeTitle(task.title))),
    }))
    .filter((milestone) => milestone.tasks.length > 0)
  if (filtered.length > 0) return filtered

  const goalTitle = cleanProposalTitle(goal) ?? 'the project goal'
  return [{
    title: 'Advance the next execution step',
    objective: `Keep ${goalTitle} moving with a concrete reviewable action.`,
    tasks: [{
      title: `Define the next step for ${goalTitle}`.slice(0, 200),
      description: 'Choose the smallest concrete action that moves this goal forward.',
      priority: 'medium',
      due_date: null,
      estimate_minutes: 45,
      confidence: 0.55,
      source: 'deterministic',
    }],
  }]
}

function validateInput(input: WorkBreakdownInput) {
  const goal = typeof input.goal === 'string' ? input.goal.trim() : ''
  if (!goal) throw badRequest('goal is required')
  if (goal.length > MAX_GOAL_LENGTH) throw badRequest(`goal must be ${MAX_GOAL_LENGTH} characters or fewer`)

  return {
    goal,
    projectId: validateRequiredUuid(input.projectId, 'project_id'),
  }
}

async function buildDeterministic(input: WorkBreakdownInput): Promise<WorkBreakdownDeterministic> {
  const validated = validateInput(input)
  const [existingTasks, project] = await Promise.all([
    listProjectTasks(validated.projectId),
    getProject(validated.projectId),
  ])
  const existingTitles = existingTasks.map((task: TaskItem) => task.title)

  return {
    goal: validated.goal,
    project_id: validated.projectId,
    existing_titles: existingTitles,
    project_deadline: project.target_deadline,
    project,
    tasks: existingTasks,
    fallback_milestones: fallbackMilestones(validated.goal, existingTitles),
  }
}

async function buildContext(deterministic: WorkBreakdownDeterministic): Promise<WorkBreakdownContext> {
  const projectContext = buildProjectContextFromData(deterministic.project, deterministic.tasks, 12)

  return {
    contextJson: JSON.stringify(
      {
        goal: deterministic.goal,
        project_context: {
          project: projectContext.project,
          tasks: projectContext.tasks,
          summary: projectContext.summary,
        },
        existing_task_titles: deterministic.existing_titles,
        deterministic_fallback: deterministic.fallback_milestones,
      },
      null,
      2
    ),
    inputSummary: `Break down a goal into a reviewable execution plan for project ${deterministic.project_id}.`,
    citations: withCitations(projectContext.sources),
  }
}

function userInstruction(deterministic: WorkBreakdownDeterministic) {
  return [
    `Break down this goal: ${deterministic.goal}`,
    `Return at most ${MAX_MILESTONES} milestones and at most ${MAX_TOTAL_TASKS} total tasks.`,
    'Do not create tasks that duplicate existing_task_titles.',
    'Return JSON only in this shape: {"milestones":[{"title":"...","objective":"...","tasks":[{"title":"...","description":"...","priority":"medium","due_date":null,"estimate_minutes":60,"confidence":0.82}]}]}',
  ].join('\n')
}

function milestoneArray(json: AiWorkBreakdownJson): AiMilestoneProposal[] {
  if (Array.isArray(json)) return json
  if (Array.isArray(json.milestones)) return json.milestones
  return []
}

function normalizeTaskProposal(raw: AiTaskProposal, existing: Set<string>, seen: Set<string>, maxDate: string | null): WorkBreakdownTaskProposal | null {
  const title = cleanTitle(raw.title, '')
  const key = normalizeTitle(title)
  if (title.length < 4 || !key || existing.has(key) || seen.has(key)) return null

  const description = cleanText(raw.description, 1_000)
  const confidence = normalizeConfidence(raw.confidence, 0.72)
  if (confidence < 0.45) return null

  seen.add(key)
  return {
    title,
    description,
    priority: normalizePriority(raw.priority, `${title} ${description ?? ''}`),
    due_date: normalizeDueDate(raw.due_date, maxDate),
    estimate_minutes: normalizeEstimate(raw.estimate_minutes),
    confidence,
    source: 'ai',
  }
}

function normalizeAiMilestones(json: AiWorkBreakdownJson, existingTitles: string[], maxDate: string | null) {
  const rawMilestones = milestoneArray(json).slice(0, MAX_MILESTONES)
  const existing = new Set(existingTitles.map(normalizeTitle))
  const seen = new Set<string>()
  let rejectedCount = 0
  let totalTasks = 0

  const milestones: WorkBreakdownMilestoneProposal[] = []
  for (const rawMilestone of rawMilestones) {
    const rawTasks = Array.isArray(rawMilestone.tasks) ? (rawMilestone.tasks as AiTaskProposal[]) : []
    const tasks: WorkBreakdownTaskProposal[] = []

    for (const rawTask of rawTasks) {
      if (totalTasks >= MAX_TOTAL_TASKS || tasks.length >= MAX_TASKS_PER_MILESTONE) break
      const task = normalizeTaskProposal(rawTask, existing, seen, maxDate)
      if (!task) {
        rejectedCount += 1
        continue
      }
      tasks.push(task)
      totalTasks += 1
    }

    if (tasks.length === 0) continue
    milestones.push({
      title: cleanTitle(rawMilestone.title, 'Execution milestone'),
      objective: cleanText(rawMilestone.objective, 500),
      tasks,
    })
  }

  return { milestones, rejected_count: rejectedCount }
}

function citationsFor(context: WorkBreakdownContext) {
  return context.citations.items.map((citation) => ({
    source_type: citation.sourceType,
    source_id: citation.sourceId,
    excerpt: citation.excerpt ?? null,
  }))
}

export async function generateWorkBreakdown(userId: string, input: WorkBreakdownInput): Promise<WorkBreakdownResult> {
  const result = await executeAiJsonCapability<AiWorkBreakdownJson, WorkBreakdownDeterministic, WorkBreakdownContext>({
    userId,
    projectId: input.projectId,
    capability: 'work_breakdown',
    buildDeterministic: () => buildDeterministic(input),
    buildContext,
    buildUserInstruction: userInstruction,
    temperature: 0.25,
    maxOutputTokens: 1_400,
    schemaName: 'WorkBreakdownProposal',
  })

  if (result.mode === 'fallback') {
    return {
      milestones: result.deterministic.fallback_milestones,
      mode: 'fallback',
      fallback_reason: result.reason,
      ai_run_id: null,
      rejected_count: 0,
      citations: citationsFor(result.context),
    }
  }

  const normalized = normalizeAiMilestones(result.json, result.deterministic.existing_titles, result.deterministic.project_deadline)
  if (normalized.milestones.length === 0 && result.deterministic.fallback_milestones.length > 0) {
    return {
      milestones: result.deterministic.fallback_milestones,
      mode: 'fallback',
      fallback_reason: 'no_valid_ai_proposals',
      ai_run_id: result.run.id,
      rejected_count: normalized.rejected_count,
      citations: citationsFor(result.context),
    }
  }

  return {
    milestones: normalized.milestones,
    mode: 'ai',
    fallback_reason: null,
    ai_run_id: result.run.id,
    rejected_count: normalized.rejected_count,
    citations: citationsFor(result.context),
  }
}
