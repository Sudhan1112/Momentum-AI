const DAY_MS = 86_400_000
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

function utcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const match = DATE_ONLY.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }
  return parsed
}

export function toDateOnly(value: Date | string): string | null {
  const parsed = value instanceof Date ? value : parseTimestamp(value)
  if (!parsed || Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

export function todayDateOnly(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

export function addCalendarDays(value: Date | string, days: number): Date | null {
  const parsed = value instanceof Date ? value : parseTimestamp(value)
  if (!parsed || Number.isNaN(parsed.getTime()) || !Number.isFinite(days)) return null
  const next = new Date(parsed)
  next.setUTCDate(next.getUTCDate() + Math.trunc(days))
  return next
}

export function calendarDayDifference(from: Date | string, to: Date | string): number | null {
  const start = from instanceof Date ? from : parseTimestamp(from)
  const end = to instanceof Date ? to : parseTimestamp(to)
  if (!start || !end) return null
  return Math.round((utcDay(end) - utcDay(start)) / DAY_MS)
}

export function remainingCalendarDays(deadline: Date | string | null, now = new Date(), fallback = 7) {
  if (!deadline) return fallback
  const difference = calendarDayDifference(now, deadline)
  return difference == null || difference > 3_653 ? fallback : Math.max(1, difference)
}

export function isOverdueTimestamp(value: string | null, now = new Date()) {
  const parsed = parseTimestamp(value)
  return Boolean(parsed && parsed.getTime() < now.getTime())
}

export function timestampMs(value: string | null, fallback = Number.MAX_SAFE_INTEGER) {
  return parseTimestamp(value)?.getTime() ?? fallback
}

export function validatePlanningDate(
  value: unknown,
  options: { field: string; now?: Date; maxYears?: number; allowPast?: boolean }
) {
  if (typeof value !== 'string') return { ok: false as const, message: `${options.field} must be a date string` }
  const parsed = parseDateOnly(value.slice(0, 10))
  if (!parsed) return { ok: false as const, message: `${options.field} must be a valid calendar date` }

  const today = parseDateOnly(todayDateOnly(options.now))!
  if (!options.allowPast && parsed.getTime() < today.getTime()) {
    return { ok: false as const, message: `${options.field} cannot be before today` }
  }

  const max = new Date(today)
  max.setUTCFullYear(max.getUTCFullYear() + (options.maxYears ?? 10))
  if (parsed.getTime() > max.getTime()) {
    return { ok: false as const, message: `${options.field} cannot be more than ${options.maxYears ?? 10} years ahead` }
  }

  return { ok: true as const, value: parsed }
}
