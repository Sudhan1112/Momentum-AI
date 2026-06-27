import { describe, expect, it } from 'vitest'

import { evaluateRecoveryTriggers, recoveryGenerationMode } from './recovery-triggers'
import type { ExecutionScore } from './execution-score'
import type { WorkspaceHealthSnapshot } from './health-snapshot'

function score(overrides: Partial<ExecutionScore['metrics']> = {}, value = 85): ExecutionScore {
  return {
    scope: 'project',
    project_id: 'project',
    score: value,
    components: {
      completion: { score: 30, max: 35, reason: '' },
      overdue_control: { score: 30, max: 30, reason: '' },
      active_flow: { score: 15, max: 15, reason: '' },
      current_velocity: { score: 10, max: 20, reason: '' },
    },
    metrics: {
      total_tasks: 4,
      completed_tasks: 3,
      open_tasks: 1,
      overdue_tasks: 0,
      in_progress_tasks: 1,
      recently_completed_tasks: 2,
      average_risk: 10,
      ...overrides,
    },
    top_risks: [],
    explanation: '',
    calculated_at: '2026-06-27T00:00:00.000Z',
  }
}

function health(level: WorkspaceHealthSnapshot['level']): WorkspaceHealthSnapshot {
  return {
    scope: 'project',
    project_id: 'project',
    level,
    label: level === 'healthy' ? 'Healthy' : level === 'attention' ? 'Needs Attention' : 'Critical',
    color: level === 'healthy' ? 'green' : level === 'attention' ? 'yellow' : 'red',
    execution_score: 85,
    critical_risks: 0,
    high_risks: 0,
    overdue_tasks: 0,
    open_tasks: 1,
    reasons: [],
    calculated_at: '2026-06-27T00:00:00.000Z',
  }
}

describe('recovery eligibility', () => {
  it('blocks healthy generation unless explicitly forced', () => {
    const triggers = evaluateRecoveryTriggers(score(), health('healthy'))
    expect(triggers.should_generate).toBe(false)
    expect(recoveryGenerationMode(triggers)).toBeNull()
    expect(recoveryGenerationMode(triggers, true)).toBe('exploratory')
  })

  it('allows triggered recovery without an override', () => {
    const triggers = evaluateRecoveryTriggers(score({ overdue_tasks: 2 }, 50), health('critical'))
    expect(triggers.should_generate).toBe(true)
    expect(triggers.reasons.length).toBeGreaterThan(0)
    expect(recoveryGenerationMode(triggers)).toBe('required')
  })
})
