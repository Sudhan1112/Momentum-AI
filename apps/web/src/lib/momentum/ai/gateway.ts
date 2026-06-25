import 'server-only'

import { MomentumError } from '@/lib/momentum/errors'
import { assertAiRateLimit } from '@/lib/momentum/ai/rate-limit'
import {
  completeAiRun,
  createAiRun,
  failAiRun,
  type AiCitationInput,
  type AiRunWithCitations,
} from '@/lib/momentum/ai/run-logger'
import type { PromptDefinition } from '@/lib/momentum/ai/prompts/registry'
import { validateAiCapability } from '@/lib/momentum/validation/schemas'

type GeminiUsageMetadata = {
  promptTokenCount?: number
  candidatesTokenCount?: number
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  usageMetadata?: GeminiUsageMetadata
  error?: {
    message?: string
  }
}

export type AiCitationSet =
  | {
      items: [AiCitationInput, ...AiCitationInput[]]
      citationless?: false
    }
  | {
      items: []
      citationless: true
      reason: string
    }

type ExecuteGeminiInput = {
  userId: string
  projectId?: string | null
  taskId?: string | null
  promptDefinition: PromptDefinition
  promptText: string
  inputSummary: string
  citations: AiCitationSet
  model?: string
  temperature?: number
  maxOutputTokens?: number
  responseMimeType?: 'text/plain' | 'application/json'
  timeoutMs?: number
}

export type AiGatewayResult = {
  run: AiRunWithCitations
  text: string
  usage: {
    inputTokens: number | null
    outputTokens: number | null
  }
}

export type AiTextCompletionInput = Omit<ExecuteGeminiInput, 'responseMimeType'>

export type AiJsonCompletionInput = Omit<ExecuteGeminiInput, 'responseMimeType'> & {
  schemaName?: string
}

export type AiJsonCompletionResult<T> = AiGatewayResult & {
  json: T
}

const DEFAULT_MODEL = 'gemini-2.0-flash'

function getGeminiKey() {
  return process.env.GEMINI_API_KEY?.trim() || null
}

function getModel(inputModel?: string) {
  return inputModel?.trim() || process.env.MOMENTUM_AI_MODEL?.trim() || DEFAULT_MODEL
}

function extractText(response: GeminiResponse) {
  return response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? ''
}

export function withCitations(items: AiCitationInput[]): AiCitationSet {
  if (items.length === 0) {
    throw new MomentumError('withCitations requires at least one citation', 500)
  }
  return { items: items as [AiCitationInput, ...AiCitationInput[]] }
}

export function intentionallyCitationless(reason: string): AiCitationSet {
  const normalizedReason = reason.trim()
  if (!normalizedReason) {
    throw new MomentumError('Citationless AI calls must include a reason', 500)
  }
  return { items: [], citationless: true, reason: normalizedReason }
}

function flattenCitations(citations: AiCitationSet) {
  if (citations.items.length === 0 && !citations.citationless) {
    throw new MomentumError('Empty AI citations must be marked citationless with a reason', 500)
  }
  return citations.items
}

async function executeGeminiRun(input: ExecuteGeminiInput): Promise<AiGatewayResult> {
  const capability = validateAiCapability(input.promptDefinition.capability)
  const citations = flattenCitations(input.citations)
  assertAiRateLimit(input.userId, capability)

  const model = getModel(input.model)
  const startedAt = Date.now()
  const run = await createAiRun({
    userId: input.userId,
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    capability,
    model,
    promptVersion: input.promptDefinition.version,
    inputSummary: input.inputSummary,
  })

  const apiKey = getGeminiKey()
  if (!apiKey) {
    const failed = await failAiRun(run.id, {
      errorMessage: 'GEMINI_API_KEY is not configured',
      latencyMs: Date.now() - startedAt,
      citations,
    })
    throw new MomentumError(`Gemini is not configured for AI run ${failed.id}`, 503)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 25_000)

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: input.promptText }] }],
        generationConfig: {
          temperature: input.temperature ?? 0.2,
          maxOutputTokens: input.maxOutputTokens ?? 1024,
          responseMimeType: input.responseMimeType ?? 'text/plain',
        },
      }),
    })

    const body = (await response.json().catch(() => ({}))) as GeminiResponse
    if (!response.ok) {
      throw new Error(body.error?.message ?? `Gemini request failed with ${response.status}`)
    }

    const text = extractText(body)
    if (!text) {
      throw new Error('Gemini returned an empty response')
    }

    const usage = {
      inputTokens: body.usageMetadata?.promptTokenCount ?? null,
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? null,
    }
    const completed = await completeAiRun(run.id, {
      outputSummary: text.slice(0, 2_000),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      latencyMs: Date.now() - startedAt,
      citations,
    })

    return { run: completed, text, usage }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gemini request failed'
    const failed = await failAiRun(run.id, {
      errorMessage: message,
      latencyMs: Date.now() - startedAt,
      citations,
    })
    throw new MomentumError(`AI run ${failed.id} failed: ${message}`, 502)
  } finally {
    clearTimeout(timeout)
  }
}

export async function completeText(input: AiTextCompletionInput): Promise<AiGatewayResult> {
  return executeGeminiRun({
    ...input,
    responseMimeType: 'text/plain',
  })
}

export async function completeJson<T = unknown>(input: AiJsonCompletionInput): Promise<AiJsonCompletionResult<T>> {
  const result = await executeGeminiRun({
    ...input,
    responseMimeType: 'application/json',
  })

  try {
    return {
      ...result,
      json: JSON.parse(result.text) as T,
    }
  } catch {
    throw new MomentumError(`AI JSON response was invalid${input.schemaName ? ` for ${input.schemaName}` : ''}`, 502)
  }
}
