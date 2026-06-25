import 'server-only'

import type { AiCapability } from '@/types/momentum'

import { MomentumError } from '@/lib/momentum/errors'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

const DEFAULT_LIMIT = 20
const DEFAULT_WINDOW_MS = 60_000

export function assertAiRateLimit(
  userId: string,
  capability: AiCapability,
  options: { limit?: number; windowMs?: number } = {}
) {
  const limit = options.limit ?? DEFAULT_LIMIT
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
  const now = Date.now()
  const key = `${userId}:${capability}`
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    throw new MomentumError(`AI rate limit exceeded. Try again in ${retryAfterSeconds}s.`, 429)
  }

  current.count += 1
  buckets.set(key, current)
}
