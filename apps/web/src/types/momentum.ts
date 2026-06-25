export const MEMORY_KIND_VALUES = [
  'preference',
  'pattern',
  'goal',
  'recovery_note',
  'blocker_history',
  'context_summary',
] as const

export type MemoryKind = (typeof MEMORY_KIND_VALUES)[number]

export const MEMORY_SOURCE_VALUES = ['user', 'ai', 'system'] as const

export type MemorySource = (typeof MEMORY_SOURCE_VALUES)[number]

export const AI_CAPABILITY_VALUES = [
  'extract_tasks',
  'work_breakdown',
  'blocker_detection',
  'morning_brief',
  'recovery_plan',
  'goal_simulation',
  'risk_explain',
  'momentum_flow',
] as const

export type AiCapability = (typeof AI_CAPABILITY_VALUES)[number]

export const AI_RUN_STATUS_VALUES = ['pending', 'completed', 'failed', 'cancelled'] as const

export type AiRunStatus = (typeof AI_RUN_STATUS_VALUES)[number]

export const CITATION_SOURCE_TYPE_VALUES = [
  'document',
  'document_comment',
  'document_version',
  'task',
  'project',
  'memory_entry',
] as const

export type CitationSourceType = (typeof CITATION_SOURCE_TYPE_VALUES)[number]

export type MomentumMemoryEntry = {
  id: string
  user_id: string
  project_id: string | null
  kind: MemoryKind
  source: MemorySource
  title: string | null
  content: string
  metadata: Record<string, unknown>
  confidence: number | null
  expires_at: string | null
  supersedes_id: string | null
  created_at: string
  updated_at: string
}

export type AiRun = {
  id: string
  user_id: string
  project_id: string | null
  task_id: string | null
  capability: AiCapability
  status: AiRunStatus
  model: string | null
  prompt_version: string | null
  input_summary: string | null
  output_summary: string | null
  input_tokens: number | null
  output_tokens: number | null
  latency_ms: number | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export type AiRunCitation = {
  id: string
  ai_run_id: string
  source_type: CitationSourceType
  source_id: string
  excerpt: string | null
  metadata: Record<string, unknown>
  sort_order: number
}
