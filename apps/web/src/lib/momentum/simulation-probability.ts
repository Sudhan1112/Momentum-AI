export type SimulationProbabilityInput = {
  executionScore: number
  overdueTasks: number
  blockedTasks: number
  highOrCriticalRisks: number
  health: 'healthy' | 'attention' | 'critical'
  remainingWorkMinutes: number
  availableMinutes: number
  dailyCapacityMinutes: number
  scheduleDeltaDays: number
}

const BASE_DAILY_MINUTES = 240

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

export function simulationProbability(input: SimulationProbabilityInput) {
  const loadRatio = input.remainingWorkMinutes / Math.max(input.availableMinutes, 1)
  const loadPenalty = Math.min(35, Math.max(0, (loadRatio - 0.85) * 38))
  const schedulePenalty = Math.min(28, Math.max(0, input.scheduleDeltaDays) * 8)
  const overduePenalty = Math.min(24, Math.max(0, input.overdueTasks) * 7)
  const blockedPenalty = Math.min(20, Math.max(0, input.blockedTasks) * 5)
  const riskPenalty = Math.min(25, Math.max(0, input.highOrCriticalRisks) * 6)
  const healthPenalty = input.health === 'critical' ? 14 : input.health === 'attention' ? 6 : 0
  const capacityBonus = input.dailyCapacityMinutes > BASE_DAILY_MINUTES
    ? Math.min(10, (input.dailyCapacityMinutes - BASE_DAILY_MINUTES) / 30)
    : 0

  return Math.round(clamp(
    input.executionScore + 18 + capacityBonus - loadPenalty - schedulePenalty -
      overduePenalty - blockedPenalty - riskPenalty - healthPenalty
  ))
}
