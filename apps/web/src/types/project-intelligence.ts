import type { ProfileSummary } from '@/types/project'
import type { ProjectEventImportance, ProjectEventSource, ProjectEventType } from '@/types/project-memory'

export const TIMELINE_FILTER_VALUES = ['all', 'tasks', 'recovery', 'simulation', 'ai', 'decisions'] as const
export type TimelineFilter = (typeof TIMELINE_FILTER_VALUES)[number]

export const DECISION_CATEGORY_VALUES = [
  'architecture',
  'timeline',
  'product',
  'technical',
  'risk',
  'scope',
  'deployment',
  'budget',
] as const

export type DecisionCategory = (typeof DECISION_CATEGORY_VALUES)[number]

export type TimelineActor = {
  id: string | null
  label: string
  profile: ProfileSummary | null
}

export type TimelineFact = {
  label: string
  value: string
}

export type ProjectTimelineItem = {
  id: string
  sequence: number
  project_id: string
  event_type: ProjectEventType
  source: ProjectEventSource
  importance: ProjectEventImportance
  summary: string
  reason: string | null
  filter: TimelineFilter
  occurred_at: string
  recorded_at: string
  actor: TimelineActor
  facts: TimelineFact[]
  is_historical_import: boolean
  entity_type: string
  entity_id: string | null
}

export type DecisionEvidenceItem = ProjectTimelineItem

export type ProjectDecisionRecord = {
  id: string
  title: string
  decision: string
  reason: string | null
  category: DecisionCategory
  status: 'accepted'
  importance: ProjectEventImportance
  occurred_at: string
  actor: TimelineActor
  evidence_event_ids: string[]
  evidence: DecisionEvidenceItem[]
}

export type RecordProjectDecisionInput = {
  title: string
  decision: string
  reason?: string | null
  category: DecisionCategory
  importance?: ProjectEventImportance
  evidence_event_ids?: string[]
}

export const ASK_MOMENTUM_INTENT_VALUES = [
  'recent_changes',
  'deadline_history',
  'blockers',
  'decisions',
  'execution_score',
  'generic',
] as const

export type AskMomentumIntent = (typeof ASK_MOMENTUM_INTENT_VALUES)[number]

export type AskMomentumEvidenceItem = ProjectTimelineItem

export type AskMomentumQueryInput = {
  question: string
}

export type AskMomentumAnswer = {
  question: string
  intent: AskMomentumIntent
  generated_at: string
  mode: 'ai' | 'fallback'
  fallback_reason: string | null
  ai_run_id: string | null
  summary: string
  answer: string
  evidence: AskMomentumEvidenceItem[]
}
