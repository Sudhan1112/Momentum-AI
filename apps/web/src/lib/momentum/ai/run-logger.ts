import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  validateAiCapability,
  validateAiRunStatus,
  validateCitationExcerpt,
  validateCitationSourceType,
  validateOptionalUuid,
  validateRequiredUuid,
} from '@/lib/momentum/validation/schemas'
import type { AiCapability, AiRun, AiRunCitation, AiRunStatus, CitationSourceType } from '@/types/momentum'

export type CreateAiRunInput = {
  userId: string
  projectId?: string | null
  taskId?: string | null
  capability: AiCapability
  model?: string | null
  promptVersion?: string | null
  inputSummary?: string | null
}

export type CompleteAiRunInput = {
  outputSummary?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  latencyMs?: number | null
  citations?: AiCitationInput[]
}

export type FailAiRunInput = {
  errorMessage: string
  latencyMs?: number | null
  citations?: AiCitationInput[]
}

export type AiCitationInput = {
  sourceType: CitationSourceType
  sourceId: string
  excerpt?: string | null
  metadata?: Record<string, unknown>
  sortOrder?: number
}

export type AiRunWithCitations = AiRun & {
  citations: AiRunCitation[]
}

function validateOptionalText(value: string | null | undefined, field: string, maxLength: number) {
  if (value == null) return null
  const normalized = value.trim()
  if (!normalized) return null
  if (normalized.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer`)
  }
  return normalized
}

function validateOptionalNonNegativeInteger(value: number | null | undefined, field: string) {
  if (value == null) return null
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`)
  }
  return value
}

function normalizeRun(row: Record<string, unknown>): AiRun {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    project_id: row.project_id ? String(row.project_id) : null,
    task_id: row.task_id ? String(row.task_id) : null,
    capability: validateAiCapability(row.capability),
    status: validateAiRunStatus(row.status),
    model: row.model ? String(row.model) : null,
    prompt_version: row.prompt_version ? String(row.prompt_version) : null,
    input_summary: row.input_summary ? String(row.input_summary) : null,
    output_summary: row.output_summary ? String(row.output_summary) : null,
    input_tokens: typeof row.input_tokens === 'number' ? row.input_tokens : null,
    output_tokens: typeof row.output_tokens === 'number' ? row.output_tokens : null,
    latency_ms: typeof row.latency_ms === 'number' ? row.latency_ms : null,
    error_message: row.error_message ? String(row.error_message) : null,
    created_at: String(row.created_at),
    completed_at: row.completed_at ? String(row.completed_at) : null,
  }
}

function normalizeCitation(row: Record<string, unknown>): AiRunCitation {
  return {
    id: String(row.id),
    ai_run_id: String(row.ai_run_id),
    source_type: validateCitationSourceType(row.source_type),
    source_id: String(row.source_id),
    excerpt: row.excerpt ? String(row.excerpt) : null,
    metadata: typeof row.metadata === 'object' && row.metadata ? (row.metadata as Record<string, unknown>) : {},
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : 0,
  }
}

export async function createAiRun(input: CreateAiRunInput): Promise<AiRun> {
  validateRequiredUuid(input.userId, 'user_id')
  validateOptionalUuid(input.projectId ?? null, 'project_id')
  validateOptionalUuid(input.taskId ?? null, 'task_id')
  const capability = validateAiCapability(input.capability)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ai_runs')
    .insert({
      user_id: input.userId,
      project_id: input.projectId ?? null,
      task_id: input.taskId ?? null,
      capability,
      status: 'pending' satisfies AiRunStatus,
      model: validateOptionalText(input.model, 'model', 100),
      prompt_version: validateOptionalText(input.promptVersion, 'prompt_version', 100),
      input_summary: validateOptionalText(input.inputSummary, 'input_summary', 2_000),
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return normalizeRun(data as Record<string, unknown>)
}

export async function addAiRunCitations(aiRunId: string, citations: AiCitationInput[]) {
  validateRequiredUuid(aiRunId, 'ai_run_id')
  if (citations.length === 0) return []

  const rows = citations.map((citation, index) => ({
    ai_run_id: aiRunId,
    source_type: validateCitationSourceType(citation.sourceType),
    source_id: validateOptionalText(citation.sourceId, 'source_id', 200) ?? citation.sourceId,
    excerpt: validateCitationExcerpt(citation.excerpt ?? null),
    metadata: citation.metadata ?? {},
    sort_order: citation.sortOrder ?? index,
  }))

  const admin = createAdminClient()
  const { data, error } = await admin.from('ai_run_citations').insert(rows).select('*')

  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeCitation)
}

async function finishAiRun(aiRunId: string, status: 'completed' | 'failed', payload: Record<string, unknown>) {
  validateRequiredUuid(aiRunId, 'ai_run_id')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ai_runs')
    .update({
      ...payload,
      status,
      completed_at: new Date().toISOString(),
    })
    .eq('id', aiRunId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return normalizeRun(data as Record<string, unknown>)
}

export async function completeAiRun(aiRunId: string, input: CompleteAiRunInput): Promise<AiRunWithCitations> {
  const citations = await addAiRunCitations(aiRunId, input.citations ?? [])
  const run = await finishAiRun(aiRunId, 'completed', {
    output_summary: validateOptionalText(input.outputSummary, 'output_summary', 2_000),
    input_tokens: validateOptionalNonNegativeInteger(input.inputTokens, 'input_tokens'),
    output_tokens: validateOptionalNonNegativeInteger(input.outputTokens, 'output_tokens'),
    latency_ms: validateOptionalNonNegativeInteger(input.latencyMs, 'latency_ms'),
    error_message: null,
  })

  return { ...run, citations }
}

export async function failAiRun(aiRunId: string, input: FailAiRunInput): Promise<AiRunWithCitations> {
  const citations = await addAiRunCitations(aiRunId, input.citations ?? [])
  const run = await finishAiRun(aiRunId, 'failed', {
    error_message: validateOptionalText(input.errorMessage, 'error_message', 2_000) ?? 'AI run failed',
    latency_ms: validateOptionalNonNegativeInteger(input.latencyMs, 'latency_ms'),
  })

  return { ...run, citations }
}

export async function getAiRunWithCitations(aiRunId: string): Promise<AiRunWithCitations | null> {
  validateRequiredUuid(aiRunId, 'ai_run_id')

  const admin = createAdminClient()
  const { data: run, error: runError } = await admin.from('ai_runs').select('*').eq('id', aiRunId).maybeSingle()

  if (runError) throw new Error(runError.message)
  if (!run) return null

  const { data: citations, error: citationError } = await admin
    .from('ai_run_citations')
    .select('*')
    .eq('ai_run_id', aiRunId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (citationError) throw new Error(citationError.message)

  return {
    ...normalizeRun(run as Record<string, unknown>),
    citations: ((citations ?? []) as Record<string, unknown>[]).map(normalizeCitation),
  }
}
