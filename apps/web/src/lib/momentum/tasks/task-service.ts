import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { badRequest, MomentumError, notFound } from '@/lib/momentum/errors'
import { parseTimestamp, toDateOnly } from '@/lib/momentum/date'
import { ensureAssignableProjectMember } from '@/lib/momentum/projects/member-service'
import {
  validateEstimateMinutes,
  validateOptionalTimestamp,
  validateRequiredUuid,
  validateTaskDescription,
  validateTaskPriority,
  validateTaskStatus,
  validateTaskTitle,
} from '@/lib/momentum/validation/schemas'
import type { CreateTaskInput, Task, TaskDetail, TaskItem, UpdateTaskInput } from '@/types/task'
import type { ProfileSummary } from '@/types/project'
import {
  normalizeEventJournalError,
  taskCreatedEvent,
  taskDeletedEvent,
  taskUpdatedEvents,
} from '@/lib/momentum/memory/event-journal'

type TaskRow = Task

type ProjectRow = {
  id: string
  title: string
  status: string
  owner_id: string
  target_deadline: string | null
}

async function getProfiles(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, ProfileSummary>()

  const admin = createAdminClient()
  const { data, error } = await admin.from('profiles').select('id, email, full_name, avatar_url').in('id', userIds)

  if (error) throw new Error(error.message)

  return new Map((data ?? []).map((profile) => [profile.id, profile as ProfileSummary]))
}

async function hydrateTasks(tasks: TaskRow[]): Promise<TaskItem[]> {
  const profileMap = await getProfiles(tasks.map((task) => task.assignee_id).filter((id): id is string => Boolean(id)))

  return tasks.map((task) => ({
    ...task,
    assignee: task.assignee_id ? profileMap.get(task.assignee_id) ?? null : null,
  }))
}

function normalizeBlockedFields(payload: Record<string, unknown>) {
  if ('blocked_reason' in payload) {
    const reason = typeof payload.blocked_reason === 'string' ? payload.blocked_reason.trim() : payload.blocked_reason
    payload.blocked_reason = reason || null
    payload.blocked_at = reason ? new Date().toISOString() : null
  }
}

function normalizeCompletionFields(payload: Record<string, unknown>) {
  if (payload.status === 'done' && !payload.completed_at) {
    payload.completed_at = new Date().toISOString()
  }

  if ('status' in payload && payload.status !== 'done' && !('completed_at' in payload)) {
    payload.completed_at = null
  }
}

async function projectDeadline(projectId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.from('projects').select('target_deadline').eq('id', projectId).single()
  if (error) throw new Error(error.message)
  return (data?.target_deadline as string | null) ?? null
}

function validateTaskDueDate(value: unknown, deadline: string | null) {
  const dueAt = validateOptionalTimestamp(value, 'due_at')
  if (!dueAt || !deadline) return dueAt
  const dueDate = toDateOnly(parseTimestamp(dueAt)!)
  const deadlineDate = toDateOnly(deadline)
  if (dueDate && deadlineDate && dueDate > deadlineDate) {
    throw badRequest('due_at cannot be after the project deadline')
  }
  return dueAt
}

async function taskPayload(projectId: string, input: CreateTaskInput | UpdateTaskInput, knownDeadline?: string | null) {
  const payload: Record<string, unknown> = {}

  if ('title' in input) payload.title = validateTaskTitle(input.title)
  if ('description' in input) payload.description = validateTaskDescription(input.description)
  if ('status' in input) payload.status = validateTaskStatus(input.status)
  if ('priority' in input) payload.priority = validateTaskPriority(input.priority)
  if ('assignee_id' in input) {
    payload.assignee_id = await ensureAssignableProjectMember(projectId, input.assignee_id ?? null)
  }
  if ('due_at' in input) {
    const deadline = knownDeadline === undefined ? await projectDeadline(projectId) : knownDeadline
    payload.due_at = validateTaskDueDate(input.due_at, deadline)
  }
  if ('started_at' in input) payload.started_at = validateOptionalTimestamp(input.started_at, 'started_at')
  if ('completed_at' in input) payload.completed_at = validateOptionalTimestamp(input.completed_at, 'completed_at')
  if ('estimate_minutes' in input) payload.estimate_minutes = validateEstimateMinutes(input.estimate_minutes)
  if ('actual_minutes' in input) payload.actual_minutes = validateEstimateMinutes(input.actual_minutes, 'actual_minutes')
  if ('blocked_reason' in input) payload.blocked_reason = validateTaskDescription(input.blocked_reason)

  normalizeBlockedFields(payload)
  normalizeCompletionFields(payload)

  return payload
}

export async function listProjectTasks(projectId: string): Promise<TaskItem[]> {
  validateRequiredUuid(projectId, 'project_id')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return hydrateTasks((data ?? []) as TaskRow[])
}

export async function createTask(projectId: string, userId: string, input: CreateTaskInput): Promise<TaskDetail> {
  validateRequiredUuid(projectId, 'project_id')
  validateRequiredUuid(userId, 'user_id')

  const payload = await taskPayload(projectId, input)
  if (!payload.title) throw badRequest('title is required')
  const normalizedPayload = {
    ...payload,
    status: payload.status ?? 'todo',
    priority: payload.priority ?? 'medium',
  }
  const events = taskCreatedEvent(normalizedPayload as Parameters<typeof taskCreatedEvent>[0])

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('create_task_with_events', {
    p_project_id: projectId,
    p_actor_id: userId,
    p_payload: normalizedPayload,
    p_mutation_id: crypto.randomUUID(),
    p_events: events,
  })

  if (error) throw normalizeEventJournalError(new Error(error.message))
  const row = (Array.isArray(data) ? data[0] : data) as TaskRow | null
  if (!row?.id) throw new Error('Task event mutation returned no task')

  return getTask(row.id)
}

export async function getTask(taskId: string): Promise<TaskDetail> {
  validateRequiredUuid(taskId, 'task_id')

  const admin = createAdminClient()
  const { data: task, error } = await admin.from('tasks').select('*').eq('id', taskId).maybeSingle()

  if (error) throw new Error(error.message)
  if (!task) throw notFound('Task not found')

  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('id, title, status, owner_id, target_deadline')
    .eq('id', task.project_id)
    .single()

  if (projectError) throw new Error(projectError.message)

  const [hydrated] = await hydrateTasks([task as TaskRow])
  return {
    ...hydrated,
    project: project as ProjectRow,
  }
}

export async function updateTask(
  taskId: string,
  userId: string,
  input: UpdateTaskInput,
  options: { reason?: string | null } = {}
): Promise<TaskDetail> {
  validateRequiredUuid(taskId, 'task_id')
  validateRequiredUuid(userId, 'user_id')

  let existing = await getTask(taskId)
  const payload = await taskPayload(existing.project_id, input, existing.project.target_deadline)
  if (Object.keys(payload).length === 0) throw badRequest('No task fields provided')

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const nextTask = { ...existing, ...payload }
    const events = taskUpdatedEvents(existing, nextTask, options.reason)
    if (events.length === 0) return existing

    const admin = createAdminClient()
    const { error } = await admin.rpc('update_task_with_events', {
      p_task_id: taskId,
      p_actor_id: userId,
      p_expected_updated_at: existing.updated_at,
      p_payload: payload,
      p_mutation_id: crypto.randomUUID(),
      p_events: events,
    })

    if (!error) break
    const normalized = normalizeEventJournalError(new Error(error.message))
    if (normalized instanceof MomentumError && normalized.code === 'MUTATION_CONFLICT' && attempt === 0) {
      existing = await getTask(taskId)
      continue
    }
    throw normalized
  }

  return getTask(taskId)
}

export async function deleteTask(taskId: string, userId: string, options: { reason?: string | null } = {}) {
  validateRequiredUuid(taskId, 'task_id')
  validateRequiredUuid(userId, 'user_id')
  let existing = await getTask(taskId)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const events = taskDeletedEvent(existing, options.reason)
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('delete_task_with_events', {
      p_task_id: taskId,
      p_actor_id: userId,
      p_expected_updated_at: existing.updated_at,
      p_mutation_id: crypto.randomUUID(),
      p_events: events,
    })

    if (!error) {
      if (!data) throw notFound('Task not found')
      return { success: true }
    }

    const normalized = normalizeEventJournalError(new Error(error.message))
    if (normalized instanceof MomentumError && normalized.code === 'MUTATION_CONFLICT' && attempt === 0) {
      existing = await getTask(taskId)
      continue
    }
    throw normalized
  }

  return { success: true }
}
