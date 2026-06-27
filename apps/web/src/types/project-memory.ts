export const PROJECT_EVENT_SCHEMA_VERSION = 1 as const

export const PROJECT_EVENT_IMPORTANCE_VALUES = ['low', 'normal', 'high', 'critical'] as const
export type ProjectEventImportance = (typeof PROJECT_EVENT_IMPORTANCE_VALUES)[number]

export const PROJECT_EVENT_SOURCE_VALUES = ['user', 'system', 'ai'] as const
export type ProjectEventSource = (typeof PROJECT_EVENT_SOURCE_VALUES)[number]

export const PROJECT_EVENT_TYPE_VALUES = [
  'project.baseline_imported',
  'project.created',
  'project.updated',
  'project.status_changed',
  'project.deadline_changed',
  'task.baseline_imported',
  'task.created',
  'task.updated',
  'task.status_changed',
  'task.blocked',
  'task.unblocked',
  'task.completed',
  'task.priority_changed',
  'task.assignee_changed',
  'task.deadline_changed',
  'task.deleted',
  'recovery.generated',
  'recovery.status_changed',
  'simulation.created',
  'momentum_flow.proposed',
  'momentum_flow.applied',
  'momentum_session.moved',
  'momentum_session.locked',
  'momentum_session.completed',
  'momentum_session.skipped',
  'ai_run.completed',
  'ai_run.failed',
  'decision.accepted',
] as const

export type ProjectEventType = (typeof PROJECT_EVENT_TYPE_VALUES)[number]

export type ProjectEvent = {
  id: string
  sequence: number
  project_id: string
  schema_version: typeof PROJECT_EVENT_SCHEMA_VERSION
  event_key: string
  event_type: ProjectEventType
  entity_type: string
  entity_id: string | null
  actor_id: string | null
  source: ProjectEventSource
  importance: ProjectEventImportance
  summary: string
  reason: string | null
  before_state: Record<string, unknown>
  after_state: Record<string, unknown>
  metadata: Record<string, unknown>
  confidence: number
  occurred_at: string
  recorded_at: string
  is_historical_import: boolean
}

export type ProjectEventSpec = {
  schema_version: typeof PROJECT_EVENT_SCHEMA_VERSION
  event_type: ProjectEventType
  entity_type: 'project' | 'task'
  entity_id?: string | null
  source: ProjectEventSource
  importance: ProjectEventImportance
  summary: string
  reason?: string | null
  before_state: Record<string, unknown>
  after_state: Record<string, unknown>
  metadata: Record<string, unknown>
  confidence: number
}
