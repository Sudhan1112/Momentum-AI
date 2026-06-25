import 'server-only'

import { MomentumError } from '@/lib/momentum/errors'
import type { AiCapability } from '@/types/momentum'

import { MORNING_BRIEF_PROMPT_V1 } from './morning-brief.v1'
import { RISK_EXPLAIN_PROMPT_V1 } from './risk-explain.v1'

export type PromptDefinition = {
  capability: AiCapability
  version: string
  system: string
  instructions: readonly string[]
}

const PROMPTS: Partial<Record<AiCapability, PromptDefinition>> = {
  morning_brief: MORNING_BRIEF_PROMPT_V1,
  risk_explain: RISK_EXPLAIN_PROMPT_V1,
}

export function getPromptDefinition(capability: AiCapability) {
  return PROMPTS[capability] ?? null
}

export function requirePromptDefinition(capability: AiCapability) {
  const definition = getPromptDefinition(capability)
  if (!definition) {
    throw new MomentumError(`Prompt is not registered for AI capability: ${capability}`, 500)
  }
  return definition
}

export function buildPromptText(definition: PromptDefinition, contextJson: string, userInstruction: string) {
  return [
    definition.system,
    '',
    'Instructions:',
    ...definition.instructions.map((instruction) => `- ${instruction}`),
    '',
    'Context JSON:',
    contextJson,
    '',
    'User instruction:',
    userInstruction,
  ].join('\n')
}
