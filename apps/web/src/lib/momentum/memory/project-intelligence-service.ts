import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { badRequest } from '@/lib/momentum/errors'
import { manualDecisionAcceptedEvent, normalizeEventJournalError, decodeProjectEvent } from '@/lib/momentum/memory/event-journal'
import type { ProfileSummary } from '@/types/project'
import { PROJECT_EVENT_IMPORTANCE_VALUES, type ProjectEvent } from '@/types/project-memory'
import {
  DECISION_CATEGORY_VALUES,
  TIMELINE_FILTER_VALUES,
  type DecisionCategory,
  type ProjectDecisionRecord,
  type ProjectTimelineItem,
  type RecordProjectDecisionInput,
  type TimelineActor,
  type TimelineFact,
  type TimelineFilter,
} from '@/types/project-intelligence'

const TIMELINE_LIMIT = 200
const DECISION_LIMIT = 50

type ProjectEventRow = Record<string, unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function actorLabel(event: ProjectEvent, profile: ProfileSummary | null): string {
  if (profile?.full_name) return profile.full_name
  if (profile?.email) return profile.email
  if (event.source === 'ai') return 'Momentum AI'
  if (event.source === 'system') return 'System'
  return 'Unknown actor'
}

async function getProfiles(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, ProfileSummary>()

  const admin = createAdminClient()
  const { data, error } = await admin.from('profiles').select('id, email, full_name, avatar_url').in('id', userIds)
  if (error) throw new Error(error.message)
  return new Map((data ?? []).map((profile) => [profile.id, profile as ProfileSummary]))
}

export function timelineFilterForEventType(eventType: ProjectEvent['event_type']): TimelineFilter {
  if (eventType.startsWith('task.')) return 'tasks'
  if (eventType.startsWith('recovery.')) return 'recovery'
  if (eventType.startsWith('simulation.')) return 'simulation'
  if (eventType.startsWith('ai_run.')) return 'ai'
  if (eventType.startsWith('decision.')) return 'decisions'
  return 'all'
}

function formatValue(value: unknown) {
  if (value == null || value === '') return 'Unset'
  if (typeof value === 'number') return `${value}`
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime()) && (value.includes('T') || /^\d{4}-\d{2}-\d{2}$/.test(value))) {
      return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
    }
    return value.replace(/_/g, ' ')
  }
  return JSON.stringify(value)
}

export function timelineFactsForEvent(event: ProjectEvent): TimelineFact[] {
  const facts: TimelineFact[] = []
  const before = event.before_state
  const after = event.after_state

  if (event.event_type === 'project.deadline_changed') {
    facts.push({
      label: 'Deadline',
      value: `${formatValue(before.target_deadline)} -> ${formatValue(after.target_deadline)}`,
    })
  }

  if (event.event_type === 'recovery.generated' || event.event_type === 'recovery.status_changed') {
    const beforeScore = typeof after.before_execution_score === 'number' ? after.before_execution_score : null
    const afterScore = typeof after.after_execution_score === 'number' ? after.after_execution_score : null
    if (beforeScore != null && afterScore != null) {
      facts.push({ label: 'Expected score', value: `${beforeScore} -> ${afterScore}` })
    }
    if (after.status) facts.push({ label: 'Status', value: formatValue(after.status) })
  }

  if (event.event_type === 'simulation.created') {
    if (after.scenario_name) facts.push({ label: 'Scenario', value: formatValue(after.scenario_name) })
  }

  if (event.event_type.startsWith('ai_run.')) {
    if (after.capability) facts.push({ label: 'Capability', value: formatValue(after.capability) })
    if (after.status) facts.push({ label: 'Run status', value: formatValue(after.status) })
  }

  if (event.event_type === 'task.blocked' && after.blocked_reason) {
    facts.push({ label: 'Blocker', value: formatValue(after.blocked_reason) })
  }

  if (event.event_type === 'task.deadline_changed') {
    facts.push({
      label: 'Task deadline',
      value: `${formatValue(before.due_at)} -> ${formatValue(after.due_at)}`,
    })
  }

  if (event.event_type === 'task.priority_changed') {
    facts.push({
      label: 'Priority',
      value: `${formatValue(before.priority)} -> ${formatValue(after.priority)}`,
    })
  }

  if (event.event_type === 'decision.accepted') {
    if (after.category) facts.push({ label: 'Category', value: formatValue(after.category) })
    facts.push({ label: 'Status', value: 'Accepted' })
  }

  if (facts.length === 0 && event.reason) {
    facts.push({ label: 'Reason', value: event.reason })
  }

  return facts
}

function timelineActor(event: ProjectEvent, profiles: Map<string, ProfileSummary>): TimelineActor {
  const profile = event.actor_id ? profiles.get(event.actor_id) ?? null : null
  return {
    id: event.actor_id,
    label: actorLabel(event, profile),
    profile,
  }
}

function toTimelineItem(event: ProjectEvent, profiles: Map<string, ProfileSummary>): ProjectTimelineItem {
  return {
    id: event.id,
    sequence: event.sequence,
    project_id: event.project_id,
    event_type: event.event_type,
    source: event.source,
    importance: event.importance,
    summary: event.summary,
    reason: event.reason,
    filter: timelineFilterForEventType(event.event_type),
    occurred_at: event.occurred_at,
    recorded_at: event.recorded_at,
    actor: timelineActor(event, profiles),
    facts: timelineFactsForEvent(event),
    is_historical_import: event.is_historical_import,
    entity_type: event.entity_type,
    entity_id: event.entity_id,
  }
}

function validateTimelineFilter(value: string | null): TimelineFilter {
  if (!value) return 'all'
  if (!TIMELINE_FILTER_VALUES.includes(value as TimelineFilter)) {
    throw badRequest('Invalid timeline filter')
  }
  return value as TimelineFilter
}

function normalizeDecisionCategory(value: unknown): DecisionCategory {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!DECISION_CATEGORY_VALUES.includes(normalized as DecisionCategory)) {
    throw badRequest('Invalid decision category')
  }
  return normalized as DecisionCategory
}

function validateDecisionText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== 'string') throw badRequest(`${field} is required`)
  const trimmed = value.trim()
  if (trimmed.length < 3) throw badRequest(`${field} must be at least 3 characters`)
  if (trimmed.length > maxLength) throw badRequest(`${field} must be ${maxLength} characters or fewer`)
  return trimmed
}

function validateOptionalReason(value: unknown) {
  if (value == null) return null
  if (typeof value !== 'string') throw badRequest('reason must be a string')
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > 1000) throw badRequest('reason must be 1000 characters or fewer')
  return trimmed
}

function validateImportance(value: unknown) {
  if (value == null) return 'normal' as const
  if (!PROJECT_EVENT_IMPORTANCE_VALUES.includes(value as ProjectEvent['importance'])) {
    throw badRequest('Invalid decision importance')
  }
  return value as ProjectEvent['importance']
}

export function decisionFromEvent(
  event: ProjectEvent,
  profiles: Map<string, ProfileSummary>,
  evidenceMap: Map<string, ProjectTimelineItem>
): ProjectDecisionRecord {
  const after = isRecord(event.after_state) ? event.after_state : {}
  const metadata = isRecord(event.metadata) ? event.metadata : {}
  const evidenceEventIds = Array.isArray(metadata.evidence_event_ids)
    ? metadata.evidence_event_ids.filter((value): value is string => typeof value === 'string')
    : []

  return {
    id: event.id,
    title: typeof after.title === 'string' ? after.title : event.summary.replace(/^Decision accepted:\s*/i, ''),
    decision: typeof after.decision === 'string' ? after.decision : event.summary,
    reason: event.reason,
    category: normalizeDecisionCategory(after.category ?? metadata.category ?? 'product'),
    status: 'accepted',
    importance: event.importance,
    occurred_at: event.occurred_at,
    actor: timelineActor(event, profiles),
    evidence_event_ids: evidenceEventIds,
    evidence: evidenceEventIds.flatMap((eventId) => {
      const evidence = evidenceMap.get(eventId)
      return evidence ? [evidence] : []
    }),
  }
}

async function listProjectEvents(projectId: string, limit: number, eventTypes?: string[]) {
  const admin = createAdminClient()
  let query = admin
    .from('project_events')
    .select(
      'id, sequence, project_id, schema_version, event_key, event_type, entity_type, entity_id, actor_id, source, importance, summary, reason, before_state, after_state, metadata, confidence, occurred_at, recorded_at, is_historical_import'
    )
    .eq('project_id', projectId)
    .order('occurred_at', { ascending: false })
    .order('sequence', { ascending: false })
    .limit(limit)

  if (eventTypes && eventTypes.length > 0) {
    query = query.in('event_type', eventTypes)
  }

  const { data, error } = await query
  if (error) throw normalizeEventJournalError(new Error(error.message))
  return (data ?? []).map((row) => decodeProjectEvent(row as ProjectEventRow))
}

async function evidenceEventsByIds(projectId: string, evidenceEventIds: string[]) {
  if (evidenceEventIds.length === 0) return []
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_events')
    .select(
      'id, sequence, project_id, schema_version, event_key, event_type, entity_type, entity_id, actor_id, source, importance, summary, reason, before_state, after_state, metadata, confidence, occurred_at, recorded_at, is_historical_import'
    )
    .eq('project_id', projectId)
    .in('id', evidenceEventIds)

  if (error) throw normalizeEventJournalError(new Error(error.message))
  return (data ?? []).map((row) => decodeProjectEvent(row as ProjectEventRow))
}

export async function listProjectTimeline(projectId: string, filter: string | null = null) {
  const selectedFilter = validateTimelineFilter(filter)
  const events = await listProjectEvents(projectId, TIMELINE_LIMIT)
  const actorIds = Array.from(new Set(events.map((event) => event.actor_id).filter((value): value is string => Boolean(value))))
  const profiles = await getProfiles(actorIds)
  const items = events.map((event) => toTimelineItem(event, profiles))
  return selectedFilter === 'all' ? items : items.filter((item) => item.filter === selectedFilter)
}

export async function listProjectDecisions(projectId: string) {
  const events = await listProjectEvents(projectId, DECISION_LIMIT, ['decision.accepted'])
  const evidenceIds = Array.from(
    new Set(
      events.flatMap((event) => {
        const metadata = isRecord(event.metadata) ? event.metadata : {}
        return Array.isArray(metadata.evidence_event_ids)
          ? metadata.evidence_event_ids.filter((value): value is string => typeof value === 'string')
          : []
      })
    )
  )
  const evidenceEvents = await evidenceEventsByIds(projectId, evidenceIds)
  const actorIds = Array.from(
    new Set(
      [...events, ...evidenceEvents]
        .map((event) => event.actor_id)
        .filter((value): value is string => Boolean(value))
    )
  )
  const profiles = await getProfiles(actorIds)
  const evidenceMap = new Map(evidenceEvents.map((event) => [event.id, toTimelineItem(event, profiles)]))
  return events.map((event) => decisionFromEvent(event, profiles, evidenceMap))
}

export async function recordProjectDecision(projectId: string, userId: string, input: RecordProjectDecisionInput) {
  const title = validateDecisionText(input.title, 'title', 160)
  const decision = validateDecisionText(input.decision, 'decision', 500)
  const reason = validateOptionalReason(input.reason)
  const category = normalizeDecisionCategory(input.category)
  const importance = validateImportance(input.importance)
  const evidenceEventIds = Array.from(
    new Set((input.evidence_event_ids ?? []).filter((value): value is string => typeof value === 'string' && Boolean(value.trim())))
  )

  if (evidenceEventIds.length > 0) {
    const evidence = await evidenceEventsByIds(projectId, evidenceEventIds)
    if (evidence.length !== evidenceEventIds.length) {
      throw badRequest('One or more evidence events could not be found in this project')
    }
  }

  const events = manualDecisionAcceptedEvent({
    title,
    decision,
    reason,
    category,
    importance,
    evidence_event_ids: evidenceEventIds,
  })

  const admin = createAdminClient()
  const { error } = await admin.rpc('insert_project_event_specs', {
    p_project_id: projectId,
    p_actor_id: userId,
    p_mutation_id: crypto.randomUUID(),
    p_default_entity_id: projectId,
    p_events: events,
  })

  if (error) throw normalizeEventJournalError(new Error(error.message))

  const decisions = await listProjectDecisions(projectId)
  const created = decisions[0]
  if (!created) throw new Error('Decision could not be loaded after recording')
  return created
}
