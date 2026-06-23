export const APP_ROLE_VALUES = ['viewer', 'commenter', 'editor', 'admin', 'owner'] as const

export type AppRole = (typeof APP_ROLE_VALUES)[number]

export const PROJECT_STATUS_VALUES = ['active', 'paused', 'completed', 'archived'] as const

export type ProjectStatus = (typeof PROJECT_STATUS_VALUES)[number]

export type Project = {
  id: string
  title: string
  description: string | null
  owner_id: string
  status: ProjectStatus
  target_deadline: string | null
  goal_summary: string | null
  execution_target_score: number | null
  created_at: string
  updated_at: string
}

export type ProjectMember = {
  id: string
  project_id: string
  user_id: string
  role: AppRole
  created_at: string
}

export type ProjectWithMembers = Project & {
  members: ProjectMember[]
}

export type ProjectSummary = Pick<
  Project,
  'id' | 'title' | 'status' | 'target_deadline' | 'updated_at'
>

