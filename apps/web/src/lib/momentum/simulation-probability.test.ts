import { describe, expect, it } from 'vitest'

import { simulationProbability, type SimulationProbabilityInput } from './simulation-probability'

const baseline: SimulationProbabilityInput = {
  executionScore: 70,
  overdueTasks: 1,
  blockedTasks: 1,
  highOrCriticalRisks: 2,
  health: 'attention',
  remainingWorkMinutes: 900,
  availableMinutes: 1_200,
  dailyCapacityMinutes: 240,
  scheduleDeltaDays: 0,
}

describe('simulation probability monotonicity', () => {
  it('never falls when capacity rises, workload falls, or the deadline extends', () => {
    const base = simulationProbability(baseline)
    expect(simulationProbability({ ...baseline, availableMinutes: 1_800, dailyCapacityMinutes: 360 })).toBeGreaterThanOrEqual(base)
    expect(simulationProbability({ ...baseline, remainingWorkMinutes: 600 })).toBeGreaterThanOrEqual(base)
    expect(simulationProbability({ ...baseline, scheduleDeltaDays: -3, availableMinutes: 1_800 })).toBeGreaterThanOrEqual(base)
  })

  it('never rises when delays, blocked work, overdue work, or risk increase', () => {
    const base = simulationProbability(baseline)
    expect(simulationProbability({ ...baseline, scheduleDeltaDays: 3 })).toBeLessThanOrEqual(base)
    expect(simulationProbability({ ...baseline, blockedTasks: 2 })).toBeLessThanOrEqual(base)
    expect(simulationProbability({ ...baseline, overdueTasks: 2 })).toBeLessThanOrEqual(base)
    expect(simulationProbability({ ...baseline, highOrCriticalRisks: 3 })).toBeLessThanOrEqual(base)
  })

  it('is deterministic and bounded', () => {
    expect(simulationProbability(baseline)).toBe(simulationProbability(baseline))
    expect(simulationProbability({ ...baseline, executionScore: 1_000 })).toBe(100)
    expect(simulationProbability({ ...baseline, executionScore: -1_000 })).toBe(0)
  })
})
