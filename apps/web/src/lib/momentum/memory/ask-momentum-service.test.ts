import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { ProjectTimelineItem } from '@/types/project-intelligence'
import {
  buildDeterministicAskMomentumAnswer,
  classifyAskMomentumQuestion,
  rankAskMomentumEvidence,
} from './ask-momentum-service'

function timelineItem(overrides: Partial<ProjectTimelineItem>): ProjectTimelineItem {
  return {
    id: 'event-1',
    sequence: 1,
    project_id: 'project-1',
    event_type: 'project.updated',
    source: 'user',
    importance: 'normal',
    summary: 'Project updated',
    reason: null,
    filter: 'all',
    occurred_at: '2026-06-27T09:00:00.000Z',
    recorded_at: '2026-06-27T09:00:00.000Z',
    actor: { id: 'user-1', label: 'Sudhan', profile: null },
    facts: [],
    is_historical_import: false,
    entity_type: 'project',
    entity_id: 'project-1',
    ...overrides,
  }
}

describe('ask momentum service helpers', () => {
  it('classifies common project questions into stable intents', () => {
    expect(classifyAskMomentumQuestion('What changed this week?')).toBe('recent_changes')
    expect(classifyAskMomentumQuestion('Why was the deadline changed?')).toBe('deadline_history')
    expect(classifyAskMomentumQuestion('Who blocked this project?')).toBe('blockers')
    expect(classifyAskMomentumQuestion('Which decision delayed launch?')).toBe('decisions')
    expect(classifyAskMomentumQuestion('Why is execution score lower?')).toBe('execution_score')
  })

  it('ranks deadline events above unrelated history for deadline questions', () => {
    const deadline = timelineItem({
      id: 'deadline',
      event_type: 'project.deadline_changed',
      importance: 'high',
      summary: 'Project deadline changed from 2026-07-01 to 2026-07-15',
      facts: [{ label: 'Deadline', value: 'Jul 1, 2026 -> Jul 15, 2026' }],
    })
    const generic = timelineItem({
      id: 'generic',
      event_type: 'task.updated',
      importance: 'low',
      summary: 'Task updated: title',
    })

    expect(rankAskMomentumEvidence(deadline, 'Why was the deadline changed?', 'deadline_history')).toBeGreaterThan(
      rankAskMomentumEvidence(generic, 'Why was the deadline changed?', 'deadline_history')
    )
  })

  it('builds blocker answers from current blocker evidence', () => {
    const answer = buildDeterministicAskMomentumAnswer({
      question: 'Who blocked this project?',
      intent: 'blockers',
      project: {
        id: 'project-1',
        title: 'Momentum AI',
        status: 'active',
        target_deadline: '2026-07-15',
      },
      tasks: [
        {
          id: 'task-1',
          title: 'OAuth integration',
          status: 'blocked',
          priority: 'high',
          due_at: '2026-06-28T09:00:00.000Z',
          blocked_reason: 'API keys missing',
        },
      ],
      execution_score: {
        score: 58,
        explanation: 'Execution needs attention: the workspace has visible drag from overdue, inactive, or unfinished work.',
        overdue_tasks: 1,
        blocked_tasks: 1,
        open_tasks: 3,
      },
      evidence: [
        timelineItem({
          event_type: 'task.blocked',
          summary: 'Task blocked: OAuth integration',
          reason: 'API keys missing',
          facts: [{ label: 'Blocker', value: 'API keys missing' }],
        }),
      ],
    })

    expect(answer.summary).toContain('actor')
    expect(answer.answer).toContain('Sudhan')
    expect(answer.answer).toContain('OAuth integration')
  })

  it('falls back to project state when no evidence exists', () => {
    const answer = buildDeterministicAskMomentumAnswer({
      question: 'What changed this week?',
      intent: 'recent_changes',
      project: {
        id: 'project-1',
        title: 'Momentum AI',
        status: 'active',
        target_deadline: null,
      },
      tasks: [
        {
          id: 'task-1',
          title: 'Landing page',
          status: 'todo',
          priority: 'medium',
          due_at: null,
          blocked_reason: null,
        },
      ],
      execution_score: {
        score: 72,
        explanation: 'Execution is steady, but overdue work or low velocity is creating pressure.',
        overdue_tasks: 0,
        blocked_tasks: 0,
        open_tasks: 1,
      },
      evidence: [],
    })

    expect(answer.summary).toBe('No recent project history yet')
    expect(answer.answer).toContain('Momentum AI does not have recorded Momentum Memory events yet')
  })
})
