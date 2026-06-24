import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { badRequest, notFound } from '@/lib/momentum/errors'
import {
  validateExecutionTargetScore,
  validateOptionalTimestamp,
  validateProjectDescription,
  validateProjectStatus,
  validateProjectTitle,
  validateRequiredUuid,
} from '@/lib/momentum/validation/schemas'
import { bootstrapOwnerMember, listProjectMembers } from '@/lib/momentum/projects/member-service'
import type {
  CreateProjectInput,
  ProfileSummary,
  Project,
  ProjectDetail,
  ProjectListItem,
  ProjectTaskCounts,
  UpdateProjectInput,
} from '@/types/project'

type ProjectRow = Project

type TaskCountRow = {
  project_id: string
  status: string
  due_at: string | null
}

function normalizeProject(row: ProjectRow): Project {
  return row
}

function emptyTaskCounts(): ProjectTaskCounts {
  return { total: 0, open: 0, done: 0, blocked: 0, overdue: 0 }
}

async function getProfiles(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, ProfileSummary>()

  const admin = createAdminClient()
  const { data, error } = await admin.from('profiles').select('id, email, full_name, avatar_url').in('id', userIds)

  if (error) throw new Error(error.message)

  return new Map((data ?? []).map((profile) => [profile.id, profile as ProfileSummary]))
}

async function getTaskCounts(projectIds: string[]) {
  const counts = new Map<string, ProjectTaskCounts>()
  projectIds.forEach((projectId) => counts.set(projectId, emptyTaskCounts()))
  if (projectIds.length === 0) return counts

  const admin = createAdminClient()
  const { data, error } = await admin.from('tasks').select('project_id, status, due_at').in('project_id', projectIds)

  if (error) throw new Error(error.message)

  const now = Date.now()
  for (const task of (data ?? []) as TaskCountRow[]) {
    const current = counts.get(task.project_id) ?? emptyTaskCounts()
    current.total += 1
    if (task.status === 'done') current.done += 1
    else current.open += 1
    if (task.status === 'blocked') current.blocked += 1
    if (task.status !== 'done' && task.due_at && new Date(task.due_at).getTime() < now) {
      current.overdue += 1
    }
    counts.set(task.project_id, current)
  }

  return counts
}

async function hydrateProjects(projects: ProjectRow[]): Promise<ProjectListItem[]> {
  const ownerMap = await getProfiles(projects.map((project) => project.owner_id))
  const taskCounts = await getTaskCounts(projects.map((project) => project.id))

  return Promise.all(
    projects.map(async (project) => ({
      ...normalizeProject(project),
      owner: ownerMap.get(project.owner_id) ?? null,
      members: await listProjectMembers(project.id),
      task_counts: taskCounts.get(project.id) ?? emptyTaskCounts(),
    }))
  )
}

function projectPayload(input: CreateProjectInput | UpdateProjectInput) {
  const payload: Record<string, unknown> = {}

  if ('title' in input) payload.title = validateProjectTitle(input.title)
  if ('description' in input) payload.description = validateProjectDescription(input.description)
  if ('target_deadline' in input) payload.target_deadline = validateOptionalTimestamp(input.target_deadline, 'target_deadline')
  if ('goal_summary' in input) payload.goal_summary = validateProjectDescription(input.goal_summary)
  if ('execution_target_score' in input) {
    payload.execution_target_score = validateExecutionTargetScore(input.execution_target_score)
  }
  if ('status' in input) payload.status = validateProjectStatus(input.status)

  return payload
}

export async function listProjectsForUser(userId: string): Promise<ProjectListItem[]> {
  validateRequiredUuid(userId, 'user_id')

  const admin = createAdminClient()
  const { data: ownedProjects, error: ownedError } = await admin
    .from('projects')
    .select('*')
    .eq('owner_id', userId)

  if (ownedError) throw new Error(ownedError.message)

  const { data: memberships, error: membershipError } = await admin
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)

  if (membershipError) throw new Error(membershipError.message)

  const ownedIds = new Set((ownedProjects ?? []).map((project) => project.id))
  const memberIds = (memberships ?? []).map((membership) => membership.project_id).filter((id) => !ownedIds.has(id))

  let memberProjects: ProjectRow[] = []
  if (memberIds.length > 0) {
    const { data, error } = await admin.from('projects').select('*').in('id', memberIds)
    if (error) throw new Error(error.message)
    memberProjects = (data ?? []) as ProjectRow[]
  }

  const hydrated = await hydrateProjects([...(ownedProjects ?? []), ...memberProjects] as ProjectRow[])
  return hydrated.sort((a, b) => {
    const aDeadline = a.target_deadline ? new Date(a.target_deadline).getTime() : Number.MAX_SAFE_INTEGER
    const bDeadline = b.target_deadline ? new Date(b.target_deadline).getTime() : Number.MAX_SAFE_INTEGER
    if (aDeadline !== bDeadline) return aDeadline - bDeadline
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
}

export async function createProject(userId: string, input: CreateProjectInput): Promise<ProjectDetail> {
  validateRequiredUuid(userId, 'user_id')

  const payload = projectPayload(input)
  if (!payload.title) throw badRequest('title is required')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('projects')
    .insert({ ...payload, owner_id: userId })
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  await bootstrapOwnerMember(data.id, userId)
  return getProject(data.id)
}

export async function getProject(projectId: string): Promise<ProjectDetail> {
  validateRequiredUuid(projectId, 'project_id')

  const admin = createAdminClient()
  const { data, error } = await admin.from('projects').select('*').eq('id', projectId).maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw notFound('Project not found')

  const [project] = await hydrateProjects([data as ProjectRow])
  return project
}

export async function updateProject(projectId: string, input: UpdateProjectInput): Promise<ProjectDetail> {
  validateRequiredUuid(projectId, 'project_id')
  const payload = projectPayload(input)
  if (Object.keys(payload).length === 0) throw badRequest('No project fields provided')

  const admin = createAdminClient()
  const { error } = await admin.from('projects').update(payload).eq('id', projectId)

  if (error) throw new Error(error.message)
  return getProject(projectId)
}

export async function deleteProject(projectId: string) {
  validateRequiredUuid(projectId, 'project_id')

  const admin = createAdminClient()
  const { error, count } = await admin.from('projects').delete({ count: 'exact' }).eq('id', projectId)

  if (error) throw new Error(error.message)
  if (count === 0) throw notFound('Project not found')

  return { success: true }
}

