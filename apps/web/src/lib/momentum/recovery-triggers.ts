import 'server-only'

import type { ExecutionScore } from '@/lib/momentum/execution-score'
import type { WorkspaceHealthSnapshot } from '@/lib/momentum/health-snapshot'

export type RecoveryTriggerResult = {
  should_generate: boolean
  reasons: string[]
}

export function evaluateRecoveryTriggers(score: ExecutionScore, health: WorkspaceHealthSnapshot): RecoveryTriggerResult {
  const reasons: string[] = []
  const criticalRisks = score.top_risks.filter((risk) => risk.level === 'critical').length

  if (health.level === 'critical') {
    reasons.push('Project health is Critical.')
  }

  if (criticalRisks >= 2) {
    reasons.push(`${criticalRisks} critical tasks are active.`)
  }

  if (score.score < 55) {
    reasons.push(`Execution score is below recovery threshold (${score.score}).`)
  }

  if (score.metrics.overdue_tasks >= 2) {
    reasons.push(`${score.metrics.overdue_tasks} open tasks are overdue.`)
  }

  return {
    should_generate: reasons.length > 0,
    reasons,
  }
}
