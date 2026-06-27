import { addCalendarDays, parseDateOnly, parseTimestamp, todayDateOnly, toDateOnly } from '@/lib/momentum/date'

export function normalizeProposalKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanProposalText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null
  const normalized = value
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*|```/gi, ' '))
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*(?:[-*+\u2022]|\d+[.)])\s+/gm, '')
    .replace(/!\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_~`>|]/g, ' ')
    .replace(/^\s*(?:[-+\u2022]|\d+[.)])\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s:;,.!?()[\]{}'"-]+|[\s:;,.!?()[\]{}'"-]+$/g, '')
    .trim()
  return normalized ? normalized.slice(0, maxLength) : null
}

export function cleanProposalTitle(value: unknown, prefixPattern?: RegExp) {
  let normalized = cleanProposalText(value, 200)
  if (!normalized) return null
  if (prefixPattern) normalized = normalized.replace(prefixPattern, '').trim()
  normalized = normalized.replace(/^[\s:;,.!?()[\]{}'"-]+|[\s:;,.!?()[\]{}'"-]+$/g, '').trim()
  return normalizeProposalKey(normalized).length >= 3 ? normalized : null
}

export function normalizeProposalDate(
  value: unknown,
  options: { now?: Date; maxDate?: string | null; sourceText?: string } = {}
) {
  const now = options.now ?? new Date()
  let candidate: string | null = null

  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim()
    candidate = parseDateOnly(trimmed)?.toISOString().slice(0, 10) ?? toDateOnly(parseTimestamp(trimmed) ?? '')
  }

  const source = options.sourceText?.toLowerCase() ?? ''
  if (!candidate && /\btoday\b/.test(source)) candidate = todayDateOnly(now)
  if (!candidate && /\btomorrow\b/.test(source)) candidate = toDateOnly(addCalendarDays(now, 1) ?? now)
  if (!candidate) return null

  const today = todayDateOnly(now)
  if (candidate < today) return null
  const tenYears = new Date(Date.UTC(now.getUTCFullYear() + 10, now.getUTCMonth(), now.getUTCDate()))
  const upperBound = options.maxDate && parseDateOnly(options.maxDate.slice(0, 10))
    ? options.maxDate.slice(0, 10)
    : todayDateOnly(tenYears)
  return candidate <= upperBound ? candidate : null
}
