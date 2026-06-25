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
import { validateAiCapability } from '@/lib/momentum/validation/schemas'
import type { AiCapability } from '@/types/momentum'

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

export type AiGatewayInput = {
  userId: string
  projectId?: string | null
  taskId?: string | null
  capability: AiCapability
  prompt: string
  promptVersion: string
  inputSummary: string
  citations?: AiCitationInput[]
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

export async function executeGeminiRun(input: AiGatewayInput): Promise<AiGatewayResult> {
  const capability = validateAiCapability(input.capability)
  assertAiRateLimit(input.userId, capability)

  const model = getModel(input.model)
  const startedAt = Date.now()
  const run = await createAiRun({
    userId: input.userId,
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    capability,
    model,
    promptVersion: input.promptVersion,
    inputSummary: input.inputSummary,
  })

  const apiKey = getGeminiKey()
  if (!apiKey) {
    const failed = await failAiRun(run.id, {
      errorMessage: 'GEMINI_API_KEY is not configured',
      latencyMs: Date.now() - startedAt,
      citations: input.citations,
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
        contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
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
      citations: input.citations,
    })

    return { run: completed, text, usage }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gemini request failed'
    const failed = await failAiRun(run.id, {
      errorMessage: message,
      latencyMs: Date.now() - startedAt,
      citations: input.citations,
    })
    throw new MomentumError(`AI run ${failed.id} failed: ${message}`, 502)
  } finally {
    clearTimeout(timeout)
  }
}
