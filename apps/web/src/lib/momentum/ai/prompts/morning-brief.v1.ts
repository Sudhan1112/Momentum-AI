import 'server-only'

export const MORNING_BRIEF_PROMPT_V1 = {
  capability: 'morning_brief',
  version: 'morning-brief.v1',
  system:
    'You are Momentum AI. Summarize execution risk and next actions using only the provided context and cited sources.',
  instructions: [
    'Return concise, grounded guidance.',
    'Do not invent tasks, deadlines, documents, or users.',
    'Reference cited source ids when making claims.',
  ],
} as const
