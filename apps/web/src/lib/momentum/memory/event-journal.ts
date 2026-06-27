import { MomentumError } from '@/lib/momentum/errors'
import {
  PROJECT_EVENT_IMPORTANCE_VALUES,
  PROJECT_EVENT_SCHEMA_VERSION,
  PROJECT_EVENT_SOURCE_VALUES,
  PROJECT_EVENT_TYPE_VALUES,
  type ProjectEvent,
  type ProjectEventImportance,
  type ProjectEventSpec,
  type ProjectEventType,
} from '@/types/project-memory'

const MAX_SUMMARY_LENGTH = 500
const MAX_REASON_LENGTH = 2_000
const MAX_BLOCKER_REASON_LENGTH = 500

export function eventKeyForMutation(mutationId: string, index: number) {
  if (!mutationId || !Number.isInteger(index) || index < 1) {
    throw new Error('mutationId and a one-based event index are required')
  }
  return `${mutationId}:${index}`
}

type ProjectState = {
  id?: string
  title?: string | null
  description?: string | null
  status?: string | null
  target_deadline?: string | null
  execution_target_score?: number | null
  goal_summary?: string | null
}

type TaskState = {
  id?: string
  title?: string | null
  description?: string | null
  status?: string | null
  priority?: string | null
  assignee_id?: string | null
  due_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  estimate_minutes?: number | null
  actual_minutes?: number | null
  blocked_reason?: string | null
}

function compactObject(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
}

function cap(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return value == null ? null : String(value).slice(0, maxLength)
  return value.trim().slice(0, maxLength) || null
}

function changed(before: Record<string, unknown>, after: Record<string, unknown>, field: string) {
  return JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null)
}

function event(
  input: Omit<ProjectEventSpec, 'schema_version' | 'source' | 'confidence' | 'metadata'> & {
    metadata?: Record<string, unknown>
  }
): ProjectEventSpec {
  return {
    schema_version: PROJECT_EVENT_SCHEMA_VERSION,
    source: 'user',
    confidence: 100,
    metadata: input.metadata ?? {},
    ...input,
    summary: input.summary.trim().slice(0, MAX_SUMMARY_LENGTH),
    reason: cap(input.reason, MAX_REASON_LENGTH) as string | null,
  }
}

export function sanitizeProjectEventState(value: ProjectState) {
  return compactObject({
    title: cap(value.title, 200),
    status: value.status ?? null,
    target_deadline: value.target_deadline ?? null,
    execution_target_score: value.execution_target_score ?? null,
    goal_summary: cap(value.goal_summary, 500),
  })
}

export function sanitizeTaskEventState(value: TaskState) {
  return compactObject({
    title: cap(value.title, 200),
    status: value.status ?? null,
    priority: value.priority ?? null,
    assignee_id: value.assignee_id ?? null,
    due_at: value.due_at ?? null,
    started_at: value.started_at ?? null,
    completed_at: value.completed_at ?? null,
    estimate_minutes: value.estimate_minutes ?? null,
    actual_minutes: value.actual_minutes ?? null,
    blocked_reason: cap(value.blocked_reason, MAX_BLOCKER_REASON_LENGTH),
  })
}

export function projectCreatedEvent(project: ProjectState, reason?: string | null) {
  const after = sanitizeProjectEventState(project)
  return [event({
    event_type: 'project.created',
    entity_type: 'project',
    entity_id: project.id ?? null,
    importance: 'normal',
    summary: `Project created: ${after.title ?? 'Untitled project'}`,
    reason,
    before_state: {},
    after_state: after,
  })]
}

export function projectUpdatedEvents(beforeInput: ProjectState, afterInput: ProjectState, reason?: string | null) {
  const before = sanitizeProjectEventState(beforeInput)
  const after = sanitizeProjectEventState(afterInput)
  const events: ProjectEventSpec[] = []

  if (changed(before, after, 'status')) {
    events.push(event({
      event_type: 'project.status_changed',
      entity_type: 'project',
      entity_id: beforeInput.id ?? null,
      importance: after.status === 'archived' ? 'critical' : 'high',
      summary: `Project status changed from ${before.status ?? 'unset'} to ${after.status ?? 'unset'}`,
      reason,
      before_state: { status: before.status ?? null },
      after_state: { status: after.status ?? null },
    }))
  }

  if (changed(before, after, 'target_deadline')) {
    events.push(event({
      event_type: 'project.deadline_changed',
      entity_type: 'project',
      entity_id: beforeInput.id ?? null,
      importance: 'high',
      summary: `Project deadline changed from ${before.target_deadline ?? 'unset'} to ${after.target_deadline ?? 'unset'}`,
      reason,
      before_state: { target_deadline: before.target_deadline ?? null },
      after_state: { target_deadline: after.target_deadline ?? null },
    }))
  }

  const genericFields = ['title', 'execution_target_score', 'goal_summary'].filter((field) => changed(before, after, field))
  if (JSON.stringify(beforeInput.description ?? null) !== JSON.stringify(afterInput.description ?? null)) {
    genericFields.push('description')
  }
  if (genericFields.length > 0) {
    events.push(event({
      event_type: 'project.updated',
      entity_type: 'project',
      entity_id: beforeInput.id ?? null,
      importance: 'low',
      summary: `Project updated: ${genericFields.join(', ')}`,
      reason,
      before_state: Object.fromEntries(genericFields.filter((field) => field !== 'description').map((field) => [field, before[field] ?? null])),
      after_state: Object.fromEntries(genericFields.filter((field) => field !== 'description').map((field) => [field, after[field] ?? null])),
      metadata: { changed_fields: genericFields },
    }))
  }

  return events
}

export function taskCreatedEvent(task: TaskState, reason?: string | null) {
  const after = sanitizeTaskEventState(task)
  return [event({
    event_type: 'task.created',
    entity_type: 'task',
    entity_id: task.id ?? null,
    importance: after.status === 'blocked' ? 'high' : 'normal',
    summary: `Task created: ${after.title ?? 'Untitled task'}`,
    reason,
    before_state: {},
    after_state: after,
  })]
}

export function taskUpdatedEvents(beforeInput: TaskState, afterInput: TaskState, reason?: string | null) {
  const before = sanitizeTaskEventState(beforeInput)
  const after = sanitizeTaskEventState(afterInput)
  const events: ProjectEventSpec[] = []
  const entityId = beforeInput.id ?? null

  const statusChanged = changed(before, after, 'status')
  const blockerChanged = changed(before, after, 'blocked_reason')
  if (statusChanged || (after.status === 'blocked' && blockerChanged)) {
    const eventType =
      after.status === 'blocked'
        ? 'task.blocked'
        : after.status === 'done'
            ? 'task.completed'
            : before.status === 'blocked'
              ? 'task.unblocked'
              : 'task.status_changed'
    events.push(event({
      event_type: eventType,
      entity_type: 'task',
      entity_id: entityId,
      importance: ['task.blocked', 'task.unblocked', 'task.completed'].includes(eventType) ? 'high' : 'normal',
      summary:
        eventType === 'task.blocked'
          ? `Task blocked: ${after.title ?? 'Untitled task'}`
          : eventType === 'task.unblocked'
            ? `Task unblocked: ${after.title ?? 'Untitled task'}`
            : eventType === 'task.completed'
              ? `Task completed: ${after.title ?? 'Untitled task'}`
              : `Task status changed from ${before.status ?? 'unset'} to ${after.status ?? 'unset'}`,
      reason: reason ?? (eventType === 'task.blocked' ? (after.blocked_reason as string | null) : null),
      before_state: { status: before.status ?? null, blocked_reason: before.blocked_reason ?? null },
      after_state: { status: after.status ?? null, blocked_reason: after.blocked_reason ?? null },
    }))
  }

  const materialChanges: Array<[string, ProjectEventType, ProjectEventImportance]> = [
    ['priority', 'task.priority_changed', 'high'],
    ['assignee_id', 'task.assignee_changed', 'normal'],
    ['due_at', 'task.deadline_changed', 'high'],
  ]
  for (const [field, eventType, importance] of materialChanges) {
    if (!changed(before, after, field)) continue
    events.push(event({
      event_type: eventType,
      entity_type: 'task',
      entity_id: entityId,
      importance,
      summary: `Task ${field.replace(/_/g, ' ')} changed from ${before[field] ?? 'unset'} to ${after[field] ?? 'unset'}`,
      reason,
      before_state: { [field]: before[field] ?? null },
      after_state: { [field]: after[field] ?? null },
    }))
  }

  const genericFields = ['title', 'started_at', 'completed_at', 'estimate_minutes', 'actual_minutes'].filter(
    (field) => changed(before, after, field) && !(field === 'completed_at' && after.status === 'done')
  )
  if (JSON.stringify(beforeInput.description ?? null) !== JSON.stringify(afterInput.description ?? null)) {
    genericFields.push('description')
  }
  if (genericFields.length > 0) {
    events.push(event({
      event_type: 'task.updated',
      entity_type: 'task',
      entity_id: entityId,
      importance: 'low',
      summary: `Task updated: ${genericFields.join(', ')}`,
      reason,
      before_state: Object.fromEntries(genericFields.filter((field) => field !== 'description').map((field) => [field, before[field] ?? null])),
      after_state: Object.fromEntries(genericFields.filter((field) => field !== 'description').map((field) => [field, after[field] ?? null])),
      metadata: { changed_fields: genericFields },
    }))
  }

  return events
}

export function taskDeletedEvent(task: TaskState, reason?: string | null) {
  const before = sanitizeTaskEventState(task)
  return [event({
    event_type: 'task.deleted',
    entity_type: 'task',
    entity_id: task.id ?? null,
    importance: 'high',
    summary: `Task deleted: ${before.title ?? 'Untitled task'}`,
    reason,
    before_state: before,
    after_state: {},
  })]
}

function record(value: unknown) {
  return typeof value === 'object' && value && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function decodeProjectEvent(row: Record<string, unknown>): ProjectEvent {
  if (row.schema_version !== PROJECT_EVENT_SCHEMA_VERSION) {
    throw new MomentumError(`Unsupported project event schema version: ${String(row.schema_version)}`, 500, 'PROJECT_EVENT_VERSION_UNSUPPORTED')
  }
  if (!PROJECT_EVENT_SOURCE_VALUES.includes(row.source as ProjectEvent['source'])) {
    throw new MomentumError('Invalid project event source', 500)
  }
  if (!PROJECT_EVENT_IMPORTANCE_VALUES.includes(row.importance as ProjectEvent['importance'])) {
    throw new MomentumError('Invalid project event importance', 500)
  }
  if (!PROJECT_EVENT_TYPE_VALUES.includes(row.event_type as ProjectEvent['event_type'])) {
    throw new MomentumError(`Unsupported project event type: ${String(row.event_type)}`, 500, 'PROJECT_EVENT_TYPE_UNSUPPORTED')
  }

  return {
    id: String(row.id),
    sequence: Number(row.sequence),
    project_id: String(row.project_id),
    schema_version: PROJECT_EVENT_SCHEMA_VERSION,
    event_key: String(row.event_key),
    event_type: row.event_type as ProjectEvent['event_type'],
    entity_type: String(row.entity_type),
    entity_id: row.entity_id ? String(row.entity_id) : null,
    actor_id: row.actor_id ? String(row.actor_id) : null,
    source: row.source as ProjectEvent['source'],
    importance: row.importance as ProjectEvent['importance'],
    summary: String(row.summary),
    reason: row.reason ? String(row.reason) : null,
    before_state: record(row.before_state),
    after_state: record(row.after_state),
    metadata: record(row.metadata),
    confidence: Number(row.confidence),
    occurred_at: String(row.occurred_at),
    recorded_at: String(row.recorded_at),
    is_historical_import: Boolean(row.is_historical_import),
  }
}

export function normalizeEventJournalError(caught: unknown) {
  if (caught instanceof MomentumError) return caught
  const message = caught instanceof Error ? caught.message : String(caught)
  const lower = message.toLowerCase()
  if (
    (lower.includes('project_events') || lower.includes('with_events')) &&
    (lower.includes('schema cache') || lower.includes('does not exist') || lower.includes('could not find'))
  ) {
    return new MomentumError(
      'Momentum Memory database setup is required. Apply supabase/patches/add_project_event_journal.sql and reload the schema.',
      503,
      'PROJECT_EVENT_JOURNAL_SETUP_REQUIRED'
    )
  }
  if (lower.includes('mutation conflict')) {
    return new MomentumError('This record changed while you were editing it. Refresh and try again.', 409, 'MUTATION_CONFLICT')
  }
  return caught
}
