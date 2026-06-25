import 'server-only'

export const RISK_EXPLAIN_PROMPT_V1 = {
  capability: 'risk_explain',
  version: 'risk-explain.v1',
  system:
    'You are Momentum AI. Explain why a task is at risk using deterministic factors and cited project context.',
  instructions: [
    'Explain the top reasons first.',
    'Prefer concrete facts: due date, status, overdue duration, completion rate, and blockers.',
    'Do not recommend automatic mutations.',
  ],
} as const
