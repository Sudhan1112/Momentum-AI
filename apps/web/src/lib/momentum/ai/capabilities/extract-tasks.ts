import 'server-only'

import { executeAiJsonCapability, type AiExecutionContext, type AiFallbackReason } from '@/lib/momentum/ai/executor'
import { intentionallyCitationless, withCitations } from '@/lib/momentum/ai/gateway'
import { buildProjectContext } from '@/lib/momentum/ai/context-builder'
import type { AiCitationInput } from '@/lib/momentum/ai/run-logger'
import { badRequest } from '@/lib/momentum/errors'
import { listProjectTasks } from '@/lib/momentum/tasks/task-service'
import { validateOptionalUuid } from '@/lib/momentum/validation/schemas'
import type { TaskItem, TaskPriority } from '@/types/task'

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
const MAX_SOURCE_TEXT = 12_000
const MAX_PROPOSALS = 12

export type TaskExtractionProposal = {
  title: string
  description: string | null
  priority: TaskPriority
  due_date: string | null
  confidence: number
  source: 'ai' | 'deterministic'
}

export type ExtractTasksInput = {
  text: string
  projectId?: string | null
  documentId?: string | null
}

export type ExtractTasksResult = {
  proposal: TaskExtractionProposal[]
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

type ExtractTasksDeterministic = {
  text: string
  project_id: string | null
  document_id: string | null
  existing_titles: string[]
  fallback_proposals: TaskExtractionProposal[]
}

type ExtractTasksContext = AiExecutionContext

type AiTaskProposal = {
  title?: unknown
  description?: unknown
  priority?: unknown
  due_date?: unknown
  confidence?: unknown
}

type AiTaskExtractionJson =
  | {
      proposal?: AiTaskProposal[]
      proposals?: AiTaskProposal[]
    }
  | AiTaskProposal[]

function normalizeTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanTitle(value: string) {
  return value
    .replace(/^[-*\u2022\d.)\]\[\sx]+/i, '')
    .replace(/^(todo|task|action item|need to|we need to|please)\s*[:,-]?\s*/i, '')
    .trim()
    .slice(0, 200)
}

function cleanDescription(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized.slice(0, 1_000) : null
}

function normalizePriority(value: unknown, text = ''): TaskPriority {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (PRIORITIES.includes(normalized as TaskPriority)) return normalized as TaskPriority
  }

  const signal = text.toLowerCase()
  if (/\b(urgent|asap|immediately|critical)\b/.test(signal)) return 'urgent'
  if (/\b(blocked|deadline|deploy|fix|risk|overdue)\b/.test(signal)) return 'high'
  if (/\b(optional|later|someday|nice to have)\b/.test(signal)) return 'low'
  return 'medium'
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function normalizeDueDate(value: unknown, sourceText = '') {
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !Number.isNaN(new Date(`${trimmed}T00:00:00`).getTime())) {
      return trimmed
    }

    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) return dateOnly(parsed)
  }

  const source = sourceText.toLowerCase()
  const today = new Date()
  if (/\btoday\b/.test(source)) return dateOnly(today)
  if (/\btomorrow\b/.test(source)) {
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    return dateOnly(tomorrow)
  }

  return null
}

function normalizeConfidence(value: unknown, fallback: number) {
  const raw = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(raw)) return fallback
  const normalized = raw > 1 ? raw / 100 : raw
  return Math.round(Math.min(1, Math.max(0, normalized)) * 100) / 100
}

function proposalFromLine(line: string): TaskExtractionProposal | null {
  const title = cleanTitle(line)
  if (title.length < 4 || title.split(/\s+/).length > 16) return null
  if (/^(notes?|meeting|agenda|summary)$/i.test(title)) return null

  return {
    title,
    description: null,
    priority: normalizePriority(null, line),
    due_date: normalizeDueDate(null, line),
    confidence: /\b(today|tomorrow|urgent|asap|deploy|fix|prepare|review|send|finish|create|test|meet)\b/i.test(line) ? 0.72 : 0.6,
    source: 'deterministic',
  }
}

function deterministicExtract(text: string, existingTitles: string[]) {
  const existing = new Set(existingTitles.map(normalizeTitle))
  const seen = new Set<string>()
  const candidates = text
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)

  const proposals: TaskExtractionProposal[] = []
  for (const candidate of candidates) {
    const proposal = proposalFromLine(candidate)
    if (!proposal) continue
    const key = normalizeTitle(proposal.title)
    if (!key || seen.has(key) || existing.has(key)) continue
    seen.add(key)
    proposals.push(proposal)
    if (proposals.length >= MAX_PROPOSALS) break
  }

  return proposals
}

function normalizeAiProposal(raw: AiTaskProposal, existing: Set<string>, seen: Set<string>): TaskExtractionProposal | null {
  if (typeof raw.title !== 'string') return null
  const title = cleanTitle(raw.title)
  const key = normalizeTitle(title)
  if (title.length < 4 || !key || existing.has(key) || seen.has(key)) return null

  const confidence = normalizeConfidence(raw.confidence, 0.7)
  if (confidence < 0.45) return null

  seen.add(key)
  return {
    title,
    description: cleanDescription(raw.description),
    priority: normalizePriority(raw.priority, `${title} ${typeof raw.description === 'string' ? raw.description : ''}`),
    due_date: normalizeDueDate(raw.due_date, `${title} ${typeof raw.description === 'string' ? raw.description : ''}`),
    confidence,
    source: 'ai',
  }
}

function proposalArray(json: AiTaskExtractionJson): AiTaskProposal[] {
  if (Array.isArray(json)) return json
  if (Array.isArray(json.proposal)) return json.proposal
  if (Array.isArray(json.proposals)) return json.proposals
  return []
}

function normalizeAiProposals(json: AiTaskExtractionJson, existingTitles: string[]) {
  const existing = new Set(existingTitles.map(normalizeTitle))
  const seen = new Set<string>()
  const raw = proposalArray(json)
  const proposal = raw
    .map((item) => normalizeAiProposal(item, existing, seen))
    .filter((item): item is TaskExtractionProposal => Boolean(item))
    .slice(0, MAX_PROPOSALS)

  return {
    proposal,
    rejected_count: Math.max(0, raw.length - proposal.length),
  }
}

function validateInput(input: ExtractTasksInput) {
  const text = typeof input.text === 'string' ? input.text.trim() : ''
  if (!text) throw badRequest('text is required')
  if (text.length > MAX_SOURCE_TEXT) throw badRequest(`text must be ${MAX_SOURCE_TEXT} characters or fewer`)

  return {
    text,
    projectId: validateOptionalUuid(input.projectId ?? null, 'project_id'),
    documentId: validateOptionalUuid(input.documentId ?? null, 'document_id'),
  }
}

async function existingProjectTitles(projectId: string | null) {
  if (!projectId) return []
  const tasks = await listProjectTasks(projectId)
  return tasks.map((task: TaskItem) => task.title)
}

async function buildDeterministic(input: ExtractTasksInput): Promise<ExtractTasksDeterministic> {
  const validated = validateInput(input)
  const existingTitles = await existingProjectTitles(validated.projectId)

  return {
    text: validated.text,
    project_id: validated.projectId,
    document_id: validated.documentId,
    existing_titles: existingTitles,
    fallback_proposals: deterministicExtract(validated.text, existingTitles),
  }
}

async function buildContext(deterministic: ExtractTasksDeterministic): Promise<ExtractTasksContext> {
  const projectContext = deterministic.project_id
    ? await buildProjectContext({ projectId: deterministic.project_id, maxTasks: 8 })
    : null
  const citations: AiCitationInput[] = [
    ...(projectContext?.sources ?? []),
    ...(deterministic.document_id
      ? [
          {
            sourceType: 'document' as const,
            sourceId: deterministic.document_id,
            excerpt: deterministic.text.slice(0, 500),
            metadata: { source: 'selected_text' },
            sortOrder: (projectContext?.sources.length ?? 0) + 1,
          },
        ]
      : []),
  ]

  return {
    contextJson: JSON.stringify(
      {
        source_text: deterministic.text,
        project_context: projectContext
          ? {
              project: projectContext.project,
              tasks: projectContext.tasks,
              summary: projectContext.summary,
            }
          : null,
        existing_task_titles: deterministic.existing_titles,
        deterministic_fallback: deterministic.fallback_proposals,
      },
      null,
      2
    ),
    inputSummary: `Extract task proposals from ${deterministic.text.length} characters of source text.`,
    citations:
      citations.length > 0
        ? withCitations(citations)
        : intentionallyCitationless('Task extraction was requested from pasted text without project or document context.'),
  }
}

function userInstruction() {
  return [
    'Extract only concrete tasks from source_text.',
    'Do not create tasks that duplicate existing_task_titles.',
    'Return JSON only in this shape: {"proposal":[{"title":"...","description":"...","priority":"medium","due_date":null,"confidence":0.82}]}',
  ].join('\n')
}

function citationsFor(context: ExtractTasksContext) {
  return context.citations.items.map((citation) => ({
    source_type: citation.sourceType,
    source_id: citation.sourceId,
    excerpt: citation.excerpt ?? null,
  }))
}

export async function extractTaskProposals(userId: string, input: ExtractTasksInput): Promise<ExtractTasksResult> {
  const result = await executeAiJsonCapability<AiTaskExtractionJson, ExtractTasksDeterministic, ExtractTasksContext>({
    userId,
    projectId: input.projectId ?? null,
    capability: 'extract_tasks',
    buildDeterministic: () => buildDeterministic(input),
    buildContext,
    buildUserInstruction: userInstruction,
    temperature: 0.2,
    maxOutputTokens: 900,
    schemaName: 'TaskExtractionProposal',
  })

  if (result.mode === 'fallback') {
    return {
      proposal: result.deterministic.fallback_proposals,
      mode: 'fallback',
      fallback_reason: result.reason,
      ai_run_id: null,
      rejected_count: 0,
      citations: citationsFor(result.context),
    }
  }

  const normalized = normalizeAiProposals(result.json, result.deterministic.existing_titles)
  if (normalized.proposal.length === 0 && result.deterministic.fallback_proposals.length > 0) {
    return {
      proposal: result.deterministic.fallback_proposals,
      mode: 'fallback',
      fallback_reason: 'no_valid_ai_proposals',
      ai_run_id: result.run.id,
      rejected_count: normalized.rejected_count,
      citations: citationsFor(result.context),
    }
  }

  return {
    proposal: normalized.proposal,
    mode: 'ai',
    fallback_reason: null,
    ai_run_id: result.run.id,
    rejected_count: normalized.rejected_count,
    citations: citationsFor(result.context),
  }
}
