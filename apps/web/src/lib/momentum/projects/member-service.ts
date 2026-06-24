import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { badRequest, conflict, forbidden, notFound } from '@/lib/momentum/errors'
import { assertEnumValue, APP_ROLE_VALUES } from '@/lib/momentum/validation/enums'
import { validateRequiredUuid } from '@/lib/momentum/validation/schemas'
import type { AppRole, ProfileSummary, ProjectMember, ProjectMemberWithProfile } from '@/types/project'

const MANAGEABLE_PROJECT_ROLES = ['viewer', 'commenter', 'editor', 'admin'] as const

type ProjectRow = {
  id: string
  owner_id: string
}

type MemberRow = ProjectMember

type ProfileRow = ProfileSummary

function normalizeProfile(profile?: ProfileRow | null): ProfileSummary | null {
  return profile ?? null
}

async function getProfiles(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, ProfileSummary>()

  const admin = createAdminClient()
  const { data, error } = await admin.from('profiles').select('id, email, full_name, avatar_url').in('id', userIds)

  if (error) throw new Error(error.message)

  return new Map((data ?? []).map((profile) => [profile.id, profile as ProfileSummary]))
}

export async function getProjectOwner(projectId: string): Promise<ProjectRow> {
  validateRequiredUuid(projectId, 'project_id')

  const admin = createAdminClient()
  const { data, error } = await admin.from('projects').select('id, owner_id').eq('id', projectId).maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw notFound('Project not found')

  return data as ProjectRow
}

export async function bootstrapOwnerMember(projectId: string, ownerId: string) {
  validateRequiredUuid(projectId, 'project_id')
  validateRequiredUuid(ownerId, 'owner_id')

  const admin = createAdminClient()
  const { error } = await admin.from('project_members').upsert(
    {
      project_id: projectId,
      user_id: ownerId,
      role: 'owner',
    },
    { onConflict: 'project_id,user_id' }
  )

  if (error) throw new Error(error.message)
}

export async function listProjectMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
  validateRequiredUuid(projectId, 'project_id')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_members')
    .select('id, project_id, user_id, role, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  const members = (data ?? []) as MemberRow[]
  const profileMap = await getProfiles(members.map((member) => member.user_id))

  return members.map((member) => ({
    ...member,
    role: member.role as AppRole,
    profile: normalizeProfile(profileMap.get(member.user_id)),
  }))
}

export async function getProjectRole(projectId: string, userId: string): Promise<AppRole | null> {
  validateRequiredUuid(projectId, 'project_id')
  validateRequiredUuid(userId, 'user_id')

  const admin = createAdminClient()
  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError) throw new Error(projectError.message)
  if (!project) throw notFound('Project not found')
  if (project.owner_id === userId) return 'owner'

  const { data, error } = await admin
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? (data.role as AppRole) : null
}

export async function ensureProjectMember(projectId: string, userId: string) {
  const role = await getProjectRole(projectId, userId)
  if (!role) throw forbidden()
  return role
}

export async function ensureAssignableProjectMember(projectId: string, userId: string | null) {
  if (!userId) return null
  const role = await getProjectRole(projectId, userId)
  if (!role) throw badRequest('Assignee must be a project member')
  return userId
}

export async function addProjectMember(projectId: string, userId: string, role: unknown) {
  validateRequiredUuid(projectId, 'project_id')
  validateRequiredUuid(userId, 'user_id')

  const nextRole = assertEnumValue(role, APP_ROLE_VALUES, 'role')
  if (!MANAGEABLE_PROJECT_ROLES.includes(nextRole as (typeof MANAGEABLE_PROJECT_ROLES)[number])) {
    throw badRequest('Invalid member role')
  }

  const admin = createAdminClient()
  const project = await getProjectOwner(projectId)
  if (project.owner_id === userId) {
    throw badRequest('Project owner role cannot be changed')
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile) throw notFound('User not found')

  const { data, error } = await admin
    .from('project_members')
    .upsert({ project_id: projectId, user_id: userId, role: nextRole }, { onConflict: 'project_id,user_id' })
    .select('id, project_id, user_id, role, created_at')
    .single()

  if (error) throw new Error(error.message)

  return {
    ...(data as MemberRow),
    role: (data as MemberRow).role as AppRole,
    profile: profile as ProfileSummary,
  }
}

export async function removeProjectMember(projectId: string, userId: string) {
  validateRequiredUuid(projectId, 'project_id')
  validateRequiredUuid(userId, 'user_id')

  const admin = createAdminClient()
  const project = await getProjectOwner(projectId)
  if (project.owner_id === userId) {
    throw badRequest('Project owner access cannot be removed')
  }

  const { error, count } = await admin
    .from('project_members')
    .delete({ count: 'exact' })
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  if (count === 0) throw notFound('Project member not found')

  return { success: true }
}

export async function assertUniqueProjectMember(projectId: string, userId: string) {
  const role = await getProjectRole(projectId, userId)
  if (role) throw conflict('User is already a project member')
}

