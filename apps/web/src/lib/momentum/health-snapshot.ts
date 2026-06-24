import 'server-only'

import { getProjectExecutionScore, getWorkspaceExecutionScore, type ExecutionScore } from '@/lib/momentum/execution-score'

export type WorkspaceHealthLevel = 'healthy' | 'attention' | 'critical'

export type WorkspaceHealthSnapshot = {
  scope: 'workspace' | 'project'
  project_id: string | null
  level: WorkspaceHealthLevel
  label: 'Healthy' | 'Needs Attention' | 'Critical'
  color: 'green' | 'yellow' | 'red'
  execution_score: number
  critical_risks: number
  high_risks: number
  overdue_tasks: number
  open_tasks: number
  reasons: string[]
  calculated_at: string
}

function labelFor(level: WorkspaceHealthLevel): WorkspaceHealthSnapshot['label'] {
  if (level === 'critical') return 'Critical'
  if (level === 'attention') return 'Needs Attention'
  return 'Healthy'
}

function colorFor(level: WorkspaceHealthLevel): WorkspaceHealthSnapshot['color'] {
  if (level === 'critical') return 'red'
  if (level === 'attention') return 'yellow'
  return 'green'
}

export function calculateWorkspaceHealth(score: ExecutionScore): WorkspaceHealthSnapshot {
  const criticalRisks = score.top_risks.filter((risk) => risk.level === 'critical').length
  const highRisks = score.top_risks.filter((risk) => risk.level === 'high').length
  const highOrCritical = criticalRisks + highRisks
  const highRiskRatio = score.metrics.open_tasks === 0 ? 0 : highOrCritical / score.metrics.open_tasks
  const reasons: string[] = []

  let level: WorkspaceHealthLevel = 'healthy'

  if (score.score < 45 || criticalRisks >= 2 || highRiskRatio >= 0.35 || score.metrics.overdue_tasks >= 3) {
    level = 'critical'
    if (score.score < 45) reasons.push(`Execution score is ${score.score}.`)
    if (criticalRisks >= 2) reasons.push(`${criticalRisks} critical risks are active.`)
    if (highRiskRatio >= 0.35) reasons.push(`${Math.round(highRiskRatio * 100)}% of open tasks are high or critical risk.`)
    if (score.metrics.overdue_tasks >= 3) reasons.push(`${score.metrics.overdue_tasks} open tasks are overdue.`)
  } else if (score.score < 70 || highOrCritical > 0 || score.metrics.overdue_tasks > 0) {
    level = 'attention'
    if (score.score < 70) reasons.push(`Execution score is ${score.score}.`)
    if (highOrCritical > 0) reasons.push(`${highOrCritical} high-risk task${highOrCritical === 1 ? '' : 's'} need attention.`)
    if (score.metrics.overdue_tasks > 0) reasons.push(`${score.metrics.overdue_tasks} open task${score.metrics.overdue_tasks === 1 ? ' is' : 's are'} overdue.`)
  }

  if (reasons.length === 0) {
    reasons.push('Execution score is stable, overdue pressure is low, and no high-risk task is active.')
  }

  return {
    scope: score.scope,
    project_id: score.project_id,
    level,
    label: labelFor(level),
    color: colorFor(level),
    execution_score: score.score,
    critical_risks: criticalRisks,
    high_risks: highRisks,
    overdue_tasks: score.metrics.overdue_tasks,
    open_tasks: score.metrics.open_tasks,
    reasons,
    calculated_at: score.calculated_at,
  }
}

export async function getWorkspaceHealthSnapshot(userId: string) {
  return calculateWorkspaceHealth(await getWorkspaceExecutionScore(userId))
}

export async function getProjectHealthSnapshot(projectId: string) {
  return calculateWorkspaceHealth(await getProjectExecutionScore(projectId))
}
