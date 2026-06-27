import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { ProfileSummary } from '@/types/project'
import type { ProjectTimelineItem } from '@/types/project-intelligence'
import type { ProjectEvent } from '@/types/project-memory'
import {
  decisionFromEvent,
  timelineFactsForEvent,
  timelineFilterForEventType,
} from './project-intelligence-service'

function event(overrides: Partial<ProjectEvent>): ProjectEvent {
  return {
    id: 'event-id',
    sequence: 1,
    project_id: 'project-id',
    schema_version: 1,
    event_key: 'event-key',
    event_type: 'project.updated',
    entity_type: 'project',
    entity_id: 'project-id',
    actor_id: 'user-id',
    source: 'user',
    importance: 'normal',
    summary: 'Project updated',
    reason: null,
    before_state: {},
    after_state: {},
    metadata: {},
    confidence: 100,
    occurred_at: '2026-06-27T09:00:00.000Z',
    recorded_at: '2026-06-27T09:00:00.000Z',
    is_historical_import: false,
    ...overrides,
  }
}

describe('project intelligence service helpers', () => {
  it('maps event types to simple timeline filters', () => {
    expect(timelineFilterForEventType('task.completed')).toBe('tasks')
    expect(timelineFilterForEventType('recovery.generated')).toBe('recovery')
    expect(timelineFilterForEventType('simulation.created')).toBe('simulation')
    expect(timelineFilterForEventType('ai_run.completed')).toBe('ai')
    expect(timelineFilterForEventType('decision.accepted')).toBe('decisions')
    expect(timelineFilterForEventType('project.created')).toBe('all')
  })

  it('builds factual timeline chips from event state', () => {
    const facts = timelineFactsForEvent(
      event({
        event_type: 'project.deadline_changed',
        before_state: { target_deadline: '2026-07-01T00:00:00.000Z' },
        after_state: { target_deadline: '2026-07-15T00:00:00.000Z' },
      })
    )

    expect(facts).toEqual([{ label: 'Deadline', value: 'Jul 1, 2026 -> Jul 15, 2026' }])
  })

  it('hydrates decisions from immutable events and linked evidence', () => {
    const profiles = new Map<string, ProfileSummary>([
      [
        'user-id',
        { id: 'user-id', email: 'sudhan@example.com', full_name: 'Sudhan', avatar_url: null },
      ],
    ])
    const evidence: ProjectTimelineItem = {
      id: 'evidence-1',
      sequence: 4,
      project_id: 'project-id',
      event_type: 'recovery.generated',
      source: 'system',
      importance: 'high',
      summary: 'Recovery plan generated',
      reason: null,
      filter: 'recovery',
      occurred_at: '2026-06-26T09:00:00.000Z',
      recorded_at: '2026-06-26T09:00:00.000Z',
      actor: { id: null, label: 'System', profile: null },
      facts: [{ label: 'Expected score', value: '68 -> 82' }],
      is_historical_import: false,
      entity_type: 'recovery_plans',
      entity_id: 'recovery-id',
    }

    const decision = decisionFromEvent(
      event({
        event_type: 'decision.accepted',
        summary: 'Decision accepted: Delay launch',
        reason: 'Authentication is not stable.',
        importance: 'high',
        after_state: {
          title: 'Delay launch',
          decision: 'Move MVP launch to July 15.',
          category: 'timeline',
          status: 'accepted',
        },
        metadata: {
          category: 'timeline',
          evidence_event_ids: ['evidence-1'],
        },
      }),
      profiles,
      new Map([[evidence.id, evidence]])
    )

    expect(decision.title).toBe('Delay launch')
    expect(decision.actor.label).toBe('Sudhan')
    expect(decision.evidence).toHaveLength(1)
    expect(decision.evidence[0].summary).toBe('Recovery plan generated')
  })
})
