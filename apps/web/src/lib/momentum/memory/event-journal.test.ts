import { describe, expect, it } from 'vitest'

import {
  decodeProjectEvent,
  eventKeyForMutation,
  projectCreatedEvent,
  projectUpdatedEvents,
  normalizeEventJournalError,
  sanitizeTaskEventState,
  taskDeletedEvent,
  taskUpdatedEvents,
} from './event-journal'

describe('project event journal', () => {
  it('creates versioned project events without storing descriptions', () => {
    const [created] = projectCreatedEvent({
      id: 'project-id',
      title: 'Launch',
      description: 'Sensitive project body',
      status: 'active',
    })

    expect(created.schema_version).toBe(1)
    expect(created.event_type).toBe('project.created')
    expect(created.after_state).not.toHaveProperty('description')
  })

  it('emits separate material project changes and a content-free description marker', () => {
    const events = projectUpdatedEvents(
      {
        id: 'project-id',
        title: 'Launch',
        description: 'Before secret',
        status: 'active',
        target_deadline: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'project-id',
        title: 'Launch',
        description: 'After secret',
        status: 'paused',
        target_deadline: '2026-07-10T00:00:00.000Z',
      },
      'Waiting for approval'
    )

    expect(events.map((event) => event.event_type)).toEqual([
      'project.status_changed',
      'project.deadline_changed',
      'project.updated',
    ])
    expect(JSON.stringify(events)).not.toContain('Before secret')
    expect(JSON.stringify(events)).not.toContain('After secret')
    expect(events[2].metadata.changed_fields).toContain('description')
  })

  it('emits blocker, priority, and deadline events from one task mutation', () => {
    const events = taskUpdatedEvents(
      {
        id: 'task-id',
        title: 'Authentication',
        status: 'in_progress',
        priority: 'medium',
        due_at: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'task-id',
        title: 'Authentication',
        status: 'blocked',
        blocked_reason: 'API keys unavailable',
        priority: 'high',
        due_at: '2026-07-04T00:00:00.000Z',
      }
    )

    expect(events.map((event) => event.event_type)).toEqual([
      'task.blocked',
      'task.priority_changed',
      'task.deadline_changed',
    ])
    expect(events[0].reason).toBe('API keys unavailable')
  })

  it('returns no events for a no-op update', () => {
    const task = { id: 'task-id', title: 'Ship', status: 'todo', priority: 'medium' }
    expect(taskUpdatedEvents(task, { ...task })).toEqual([])
    expect(projectUpdatedEvents({ id: 'project-id', title: 'A' }, { id: 'project-id', title: 'A' })).toEqual([])
  })

  it('sanitizes descriptions and caps blocker reasons in deleted snapshots', () => {
    const longReason = 'x'.repeat(700)
    const state = sanitizeTaskEventState({
      title: 'Delete me',
      description: 'Never persist this',
      blocked_reason: longReason,
    })
    const [deleted] = taskDeletedEvent({
      id: 'task-id',
      title: 'Delete me',
      description: 'Never persist this',
      blocked_reason: longReason,
    })

    expect(state).not.toHaveProperty('description')
    expect(String(state.blocked_reason)).toHaveLength(500)
    expect(JSON.stringify(deleted)).not.toContain('Never persist this')
  })

  it('uses stable mutation keys and rejects unsupported event versions', () => {
    expect(eventKeyForMutation('mutation-id', 2)).toBe('mutation-id:2')
    expect(() => decodeProjectEvent({ schema_version: 2 })).toThrow('Unsupported project event schema version')
  })

  it('decodes version-one events and rejects unknown event types', () => {
    const row = {
      id: 'event-id',
      sequence: 1,
      project_id: 'project-id',
      schema_version: 1,
      event_key: 'key',
      event_type: 'task.blocked',
      entity_type: 'task',
      entity_id: 'task-id',
      actor_id: null,
      source: 'user',
      importance: 'high',
      summary: 'Task blocked',
      reason: null,
      before_state: {},
      after_state: { status: 'blocked' },
      metadata: {},
      confidence: 100,
      occurred_at: '2026-06-27T00:00:00.000Z',
      recorded_at: '2026-06-27T00:00:00.000Z',
      is_historical_import: false,
    }
    expect(decodeProjectEvent(row).event_type).toBe('task.blocked')
    expect(() => decodeProjectEvent({ ...row, event_type: 'task.unknown' })).toThrow('Unsupported project event type')
  })

  it('maps setup and optimistic-concurrency failures to stable error codes', () => {
    const setup = normalizeEventJournalError(new Error('Could not find function update_task_with_events in the schema cache'))
    const conflict = normalizeEventJournalError(new Error('Mutation conflict'))
    expect(setup).toMatchObject({ code: 'PROJECT_EVENT_JOURNAL_SETUP_REQUIRED', status: 503 })
    expect(conflict).toMatchObject({ code: 'MUTATION_CONFLICT', status: 409 })
  })
})
