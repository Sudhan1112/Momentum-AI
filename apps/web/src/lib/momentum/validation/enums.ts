import { APP_ROLE_VALUES, PROJECT_STATUS_VALUES } from '@/types/project'
import {
  AI_CAPABILITY_VALUES,
  AI_RUN_STATUS_VALUES,
  CITATION_SOURCE_TYPE_VALUES,
  MEMORY_KIND_VALUES,
  MEMORY_SOURCE_VALUES,
} from '@/types/momentum'
import { TASK_PRIORITY_VALUES, TASK_STATUS_VALUES } from '@/types/task'

export {
  APP_ROLE_VALUES,
  PROJECT_STATUS_VALUES,
  TASK_STATUS_VALUES,
  TASK_PRIORITY_VALUES,
  MEMORY_KIND_VALUES,
  MEMORY_SOURCE_VALUES,
  AI_CAPABILITY_VALUES,
  AI_RUN_STATUS_VALUES,
  CITATION_SOURCE_TYPE_VALUES,
}

export function isEnumValue<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T)
}

export function assertEnumValue<T extends string>(value: unknown, allowed: readonly T[], field: string) {
  if (!isEnumValue(value, allowed)) {
    throw new Error(`${field} must be one of: ${allowed.join(', ')}`)
  }

  return value
}

export const isAppRole = (value: unknown) => isEnumValue(value, APP_ROLE_VALUES)
export const isProjectStatus = (value: unknown) => isEnumValue(value, PROJECT_STATUS_VALUES)
export const isTaskStatus = (value: unknown) => isEnumValue(value, TASK_STATUS_VALUES)
export const isTaskPriority = (value: unknown) => isEnumValue(value, TASK_PRIORITY_VALUES)
export const isMemoryKind = (value: unknown) => isEnumValue(value, MEMORY_KIND_VALUES)
export const isMemorySource = (value: unknown) => isEnumValue(value, MEMORY_SOURCE_VALUES)
export const isAiCapability = (value: unknown) => isEnumValue(value, AI_CAPABILITY_VALUES)
export const isAiRunStatus = (value: unknown) => isEnumValue(value, AI_RUN_STATUS_VALUES)
export const isCitationSourceType = (value: unknown) => isEnumValue(value, CITATION_SOURCE_TYPE_VALUES)

