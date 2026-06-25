import 'server-only'

import { MomentumError } from '@/lib/momentum/errors'
import { completeJson, completeText, type AiCitationSet, type AiGatewayResult, type AiJsonCompletionResult } from './gateway'
import { buildPromptText, requirePromptDefinition } from './prompts/registry'
import type { AiCapability } from '@/types/momentum'

export type AiFallbackReason = 'gemini_unconfigured' | 'rate_limited' | 'provider_error' | 'invalid_response'

export type AiExecutionContext = {
  contextJson: string
  inputSummary: string
  citations: AiCitationSet
}

export type AiExecutionBaseInput<TDeterministic, TContext extends AiExecutionContext> = {
  userId: string
  projectId?: string | null
  taskId?: string | null
  capability: AiCapability
  buildDeterministic: () => Promise<TDeterministic> | TDeterministic
  buildContext: (deterministic: TDeterministic) => Promise<TContext> | TContext
  buildUserInstruction: (deterministic: TDeterministic, context: TContext) => string
  model?: string
  temperature?: number
  maxOutputTokens?: number
  timeoutMs?: number
}

export type AiExecutionFallback<TDeterministic, TContext> = {
  mode: 'fallback'
  reason: AiFallbackReason
  deterministic: TDeterministic
  context: TContext
  run: null
}

export type AiTextExecutionResult<TDeterministic, TContext> =
  | {
      mode: 'ai'
      text: string
      run: AiGatewayResult['run']
      usage: AiGatewayResult['usage']
      deterministic: TDeterministic
      context: TContext
    }
  | AiExecutionFallback<TDeterministic, TContext>

export type AiJsonExecutionResult<TJson, TDeterministic, TContext> =
  | {
      mode: 'ai'
      text: string
      json: TJson
      run: AiJsonCompletionResult<TJson>['run']
      usage: AiJsonCompletionResult<TJson>['usage']
      deterministic: TDeterministic
      context: TContext
    }
  | AiExecutionFallback<TDeterministic, TContext>

function fallbackReason(error: unknown): AiFallbackReason {
  if (error instanceof MomentumError) {
    if (error.status === 429) return 'rate_limited'
    if (error.status === 503) return 'gemini_unconfigured'
    if (error.message.includes('JSON response was invalid')) return 'invalid_response'
  }

  return 'provider_error'
}

async function prepareExecution<TDeterministic, TContext extends AiExecutionContext>(
  input: AiExecutionBaseInput<TDeterministic, TContext>
) {
  const deterministic = await input.buildDeterministic()
  const context = await input.buildContext(deterministic)
  const promptDefinition = requirePromptDefinition(input.capability)
  const promptText = buildPromptText(promptDefinition, context.contextJson, input.buildUserInstruction(deterministic, context))

  return { deterministic, context, promptDefinition, promptText }
}

export async function executeAiTextCapability<TDeterministic, TContext extends AiExecutionContext>(
  input: AiExecutionBaseInput<TDeterministic, TContext>
): Promise<AiTextExecutionResult<TDeterministic, TContext>> {
  const prepared = await prepareExecution(input)

  try {
    const result = await completeText({
      userId: input.userId,
      projectId: input.projectId ?? null,
      taskId: input.taskId ?? null,
      promptDefinition: prepared.promptDefinition,
      promptText: prepared.promptText,
      inputSummary: prepared.context.inputSummary,
      citations: prepared.context.citations,
      model: input.model,
      temperature: input.temperature,
      maxOutputTokens: input.maxOutputTokens,
      timeoutMs: input.timeoutMs,
    })

    return {
      mode: 'ai',
      text: result.text,
      run: result.run,
      usage: result.usage,
      deterministic: prepared.deterministic,
      context: prepared.context,
    }
  } catch (error) {
    return {
      mode: 'fallback',
      reason: fallbackReason(error),
      deterministic: prepared.deterministic,
      context: prepared.context,
      run: null,
    }
  }
}

export async function executeAiJsonCapability<TJson, TDeterministic, TContext extends AiExecutionContext>(
  input: AiExecutionBaseInput<TDeterministic, TContext> & { schemaName?: string }
): Promise<AiJsonExecutionResult<TJson, TDeterministic, TContext>> {
  const prepared = await prepareExecution(input)

  try {
    const result = await completeJson<TJson>({
      userId: input.userId,
      projectId: input.projectId ?? null,
      taskId: input.taskId ?? null,
      promptDefinition: prepared.promptDefinition,
      promptText: prepared.promptText,
      inputSummary: prepared.context.inputSummary,
      citations: prepared.context.citations,
      model: input.model,
      temperature: input.temperature,
      maxOutputTokens: input.maxOutputTokens,
      timeoutMs: input.timeoutMs,
      schemaName: input.schemaName,
    })

    return {
      mode: 'ai',
      text: result.text,
      json: result.json,
      run: result.run,
      usage: result.usage,
      deterministic: prepared.deterministic,
      context: prepared.context,
    }
  } catch (error) {
    return {
      mode: 'fallback',
      reason: fallbackReason(error),
      deterministic: prepared.deterministic,
      context: prepared.context,
      run: null,
    }
  }
}
