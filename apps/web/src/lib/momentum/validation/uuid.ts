const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function assertUuid(value: unknown, field = 'id') {
  if (!isUuid(value)) {
    throw new Error(`${field} must be a valid UUID`)
  }

  return value
}

export function assertOptionalUuid(value: unknown, field = 'id') {
  if (value == null) return null
  return assertUuid(value, field)
}

