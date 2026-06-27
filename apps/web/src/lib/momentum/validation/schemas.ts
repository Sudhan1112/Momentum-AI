import {
  AI_CAPABILITY_VALUES,
  AI_RUN_STATUS_VALUES,
  CITATION_SOURCE_TYPE_VALUES,
  MEMORY_KIND_VALUES,
  MEMORY_SOURCE_VALUES,
  PROJECT_STATUS_VALUES,
  TASK_PRIORITY_VALUES,
  TASK_STATUS_VALUES,
  assertEnumValue,
} from '@/lib/momentum/validation/enums'
import { assertOptionalUuid, assertUuid } from '@/lib/momentum/validation/uuid'
import { parseTimestamp, validatePlanningDate } from '@/lib/momentum/date'
import { badRequest } from '@/lib/momentum/errors'

export const TITLE_MAX_LENGTH = 200
export const DESCRIPTION_MAX_LENGTH = 10_000
export const MEMORY_CONTENT_MAX_LENGTH = 8_000
export const AI_TEXT_INPUT_MAX_LENGTH = 32_000
export const DOCUMENT_EXCERPT_MAX_LENGTH = 8_000
export const CITATION_EXCERPT_MAX_LENGTH = 500

function assertRequiredString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`)
  }

  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`${field} is required`)
  }

  if (normalized.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer`)
  }

  return normalized
}

function assertOptionalString(value: unknown, field: string, maxLength: number) {
  if (value == null) return null
  return assertRequiredString(value, field, maxLength)
}

function assertOptionalInteger(value: unknown, field: string, { min, max }: { min?: number; max?: number } = {}) {
  if (value == null) return null

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${field} must be an integer`)
  }

  if (min != null && value < min) {
    throw new Error(`${field} must be at least ${min}`)
  }

  if (max != null && value > max) {
    throw new Error(`${field} must be at most ${max}`)
  }

  return value
}

export function validateProjectTitle(value: unknown) {
  return assertRequiredString(value, 'title', TITLE_MAX_LENGTH)
}

export function validateProjectDescription(value: unknown) {
  return assertOptionalString(value, 'description', DESCRIPTION_MAX_LENGTH)
}

export function validateProjectStatus(value: unknown) {
  return assertEnumValue(value, PROJECT_STATUS_VALUES, 'status')
}

export function validateExecutionTargetScore(value: unknown) {
  return assertOptionalInteger(value, 'execution_target_score', { min: 0, max: 100 })
}

export function validateTaskTitle(value: unknown) {
  return assertRequiredString(value, 'title', TITLE_MAX_LENGTH)
}

export function validateTaskDescription(value: unknown) {
  return assertOptionalString(value, 'description', DESCRIPTION_MAX_LENGTH)
}

export function validateTaskStatus(value: unknown) {
  return assertEnumValue(value, TASK_STATUS_VALUES, 'status')
}

export function validateTaskPriority(value: unknown) {
  return assertEnumValue(value, TASK_PRIORITY_VALUES, 'priority')
}

export function validateEstimateMinutes(value: unknown, field = 'estimate_minutes') {
  return assertOptionalInteger(value, field, { min: 0 })
}

export function validateMemoryKind(value: unknown) {
  return assertEnumValue(value, MEMORY_KIND_VALUES, 'kind')
}

export function validateMemorySource(value: unknown) {
  return assertEnumValue(value, MEMORY_SOURCE_VALUES, 'source')
}

export function validateMemoryContent(value: unknown) {
  return assertRequiredString(value, 'content', MEMORY_CONTENT_MAX_LENGTH)
}

export function validateAiCapability(value: unknown) {
  return assertEnumValue(value, AI_CAPABILITY_VALUES, 'capability')
}

export function validateAiRunStatus(value: unknown) {
  return assertEnumValue(value, AI_RUN_STATUS_VALUES, 'status')
}

export function validateCitationSourceType(value: unknown) {
  return assertEnumValue(value, CITATION_SOURCE_TYPE_VALUES, 'source_type')
}

export function validateDocumentExcerpt(value: unknown, field = 'document_excerpt') {
  return assertOptionalString(value, field, DOCUMENT_EXCERPT_MAX_LENGTH)
}

export function validateCitationExcerpt(value: unknown) {
  return assertOptionalString(value, 'excerpt', CITATION_EXCERPT_MAX_LENGTH)
}

export function validateAiTextInput(value: unknown, field = 'text') {
  return assertRequiredString(value, field, AI_TEXT_INPUT_MAX_LENGTH)
}

export function validateRequiredUuid(value: unknown, field = 'id') {
  return assertUuid(value, field)
}

export function validateOptionalUuid(value: unknown, field = 'id') {
  return assertOptionalUuid(value, field)
}

export function validateOptionalTimestamp(value: unknown, field: string) {
  if (value == null) return null

  if (typeof value !== 'string') {
    throw badRequest(`${field} must be an ISO timestamp string`)
  }

  if (!parseTimestamp(value)) {
    throw badRequest(`${field} must be a valid ISO timestamp`)
  }

  return value
}

export function validateProjectDeadline(value: unknown, field = 'target_deadline') {
  if (value == null) return null
  const result = validatePlanningDate(value, { field })
  if (!result.ok) throw badRequest(result.message)
  return value as string
}
