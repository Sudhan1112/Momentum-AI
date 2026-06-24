import 'server-only'

import type { User } from '@supabase/supabase-js'
import type { NextResponse } from 'next/server'

import { jsonError } from '@/lib/api-route-errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { AppRole } from '@/types/project'

export type AuthzSuccess<T> = {
  ok: true
  data: T
}

export type AuthzFailure = {
  ok: false
  response: NextResponse
}

export type AuthzResult<T> = AuthzSuccess<T> | AuthzFailure

export type SessionContext = {
  user: User
}

export type ProjectAccessContext = {
  projectId: string
  userId: string
  role: AppRole
}

export type TaskAccessContext = ProjectAccessContext & {
  taskId: string
}

export type DocumentLinkAccessContext = {
  documentId: string
  userId: string
}

export type AiRunAccessContext = {
  aiRunId: string
  userId: string
  projectId: string | null
  taskId: string | null
}

const WRITE_ROLES = new Set<AppRole>(['owner', 'admin', 'editor'])
const ADMIN_ROLES = new Set<AppRole>(['owner', 'admin'])

export async function requireSession(): Promise<AuthzResult<SessionContext>> {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { ok: false, response: jsonError('Unauthorized', 401) }
  }

  return { ok: true, data: { user } }
}

async function getProjectRole(projectId: string, userId: string): Promise<AuthzResult<ProjectAccessContext>> {
  const admin = createAdminClient()
  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('id, owner_id')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError) {
    return { ok: false, response: jsonError(projectError.message, 500) }
  }

  if (!project) {
    return { ok: false, response: jsonError('Project not found', 404) }
  }

  if (project.owner_id === userId) {
    return { ok: true, data: { projectId, userId, role: 'owner' } }
  }

  const { data: membership, error: membershipError } = await admin
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (membershipError) {
    return { ok: false, response: jsonError(membershipError.message, 500) }
  }

  if (!membership) {
    return { ok: false, response: jsonError('Forbidden', 403) }
  }

  return { ok: true, data: { projectId, userId, role: membership.role as AppRole } }
}

export async function assertProjectMember(projectId: string, userId: string): Promise<AuthzResult<ProjectAccessContext>> {
  return getProjectRole(projectId, userId)
}

export async function assertProjectWriteRole(
  projectId: string,
  userId: string
): Promise<AuthzResult<ProjectAccessContext>> {
  const result = await getProjectRole(projectId, userId)
  if (!result.ok) return result
  if (!WRITE_ROLES.has(result.data.role)) {
    return { ok: false, response: jsonError('Forbidden', 403) }
  }
  return result
}

export async function assertProjectOwnerOrAdmin(
  projectId: string,
  userId: string
): Promise<AuthzResult<ProjectAccessContext>> {
  const result = await getProjectRole(projectId, userId)
  if (!result.ok) return result
  if (!ADMIN_ROLES.has(result.data.role)) {
    return { ok: false, response: jsonError('Forbidden', 403) }
  }
  return result
}

export async function assertProjectOwner(projectId: string, userId: string): Promise<AuthzResult<ProjectAccessContext>> {
  const result = await getProjectRole(projectId, userId)
  if (!result.ok) return result
  if (result.data.role !== 'owner') {
    return { ok: false, response: jsonError('Forbidden', 403) }
  }
  return result
}

export async function assertTaskAccess(taskId: string, userId: string): Promise<AuthzResult<TaskAccessContext>> {
  const admin = createAdminClient()
  const { data: task, error } = await admin.from('tasks').select('id, project_id').eq('id', taskId).maybeSingle()

  if (error) {
    return { ok: false, response: jsonError(error.message, 500) }
  }

  if (!task) {
    return { ok: false, response: jsonError('Task not found', 404) }
  }

  const result = await getProjectRole(task.project_id, userId)
  if (!result.ok) return result
  return { ok: true, data: { ...result.data, taskId } }
}

export async function assertDocumentOwnerForLink(
  documentId: string,
  userId: string
): Promise<AuthzResult<DocumentLinkAccessContext>> {
  void documentId
  void userId

  return {
    ok: false,
    response: jsonError('Document linking is not available in Sprint 1', 501),
  }
}

export async function canReadAiRun(aiRunId: string, userId: string): Promise<AuthzResult<AiRunAccessContext>> {
  void aiRunId
  void userId

  return {
    ok: false,
    response: jsonError('AI run access is not available in Sprint 1', 501),
  }
}
