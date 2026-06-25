import 'server-only'

import { MomentumError } from '@/lib/momentum/errors'
import type { AiCapability } from '@/types/momentum'

import { EXTRACT_TASKS_PROMPT_V1 } from './extract-tasks.v1'
import { GOAL_SIMULATION_PROMPT_V1 } from './goal-simulation.v1'
import { MOMENTUM_FLOW_PROMPT_V1 } from './momentum-flow.v1'
import { MORNING_BRIEF_PROMPT_V1 } from './morning-brief.v1'
import { RISK_EXPLAIN_PROMPT_V1 } from './risk-explain.v1'
import { WORK_BREAKDOWN_PROMPT_V1 } from './work-breakdown.v1'

export type PromptDefinition = {
  capability: AiCapability
  version: string
  system: string
  instructions: readonly string[]
}

const PROMPTS: Partial<Record<AiCapability, PromptDefinition>> = {
  extract_tasks: EXTRACT_TASKS_PROMPT_V1,
  goal_simulation: GOAL_SIMULATION_PROMPT_V1,
  momentum_flow: MOMENTUM_FLOW_PROMPT_V1,
  morning_brief: MORNING_BRIEF_PROMPT_V1,
  risk_explain: RISK_EXPLAIN_PROMPT_V1,
  work_breakdown: WORK_BREAKDOWN_PROMPT_V1,
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
