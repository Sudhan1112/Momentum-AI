import 'server-only'

import type { User } from '@supabase/supabase-js'
import type { NextResponse } from 'next/server'

import { jsonError } from '@/lib/api-route-errors'
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

function sprintStub(name: string): AuthzFailure {
  return {
    ok: false,
    response: jsonError(
      `${name} is a Sprint 0 authz stub. Project, task, and AI authorization helpers are activated in later sprints.`,
      501
    ),
  }
}

function markUnused(...values: unknown[]) {
  void values
}

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

export async function assertProjectMember(_projectId: string, _userId: string): Promise<AuthzResult<ProjectAccessContext>> {
  markUnused(_projectId, _userId)
  return sprintStub('assertProjectMember')
}

export async function assertProjectWriteRole(
  _projectId: string,
  _userId: string
): Promise<AuthzResult<ProjectAccessContext>> {
  markUnused(_projectId, _userId)
  return sprintStub('assertProjectWriteRole')
}

export async function assertProjectOwnerOrAdmin(
  _projectId: string,
  _userId: string
): Promise<AuthzResult<ProjectAccessContext>> {
  markUnused(_projectId, _userId)
  return sprintStub('assertProjectOwnerOrAdmin')
}

export async function assertProjectOwner(_projectId: string, _userId: string): Promise<AuthzResult<ProjectAccessContext>> {
  markUnused(_projectId, _userId)
  return sprintStub('assertProjectOwner')
}

export async function assertTaskAccess(_taskId: string, _userId: string): Promise<AuthzResult<TaskAccessContext>> {
  markUnused(_taskId, _userId)
  return sprintStub('assertTaskAccess')
}

export async function assertDocumentOwnerForLink(
  _documentId: string,
  _userId: string
): Promise<AuthzResult<DocumentLinkAccessContext>> {
  markUnused(_documentId, _userId)
  return sprintStub('assertDocumentOwnerForLink')
}

export async function canReadAiRun(_aiRunId: string, _userId: string): Promise<AuthzResult<AiRunAccessContext>> {
  markUnused(_aiRunId, _userId)
  return sprintStub('canReadAiRun')
}
