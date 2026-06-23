export const TASK_STATUS_VALUES = [
  'backlog',
  'todo',
  'in_progress',
  'blocked',
  'done',
  'cancelled',
] as const

export type TaskStatus = (typeof TASK_STATUS_VALUES)[number]

export const TASK_PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'] as const

export type TaskPriority = (typeof TASK_PRIORITY_VALUES)[number]

export type Task = {
  id: string
  project_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assignee_id: string | null
  due_at: string | null
  started_at: string | null
  completed_at: string | null
  estimate_minutes: number | null
  actual_minutes: number | null
  parent_task_id: string | null
  document_id: string | null
  sort_order: number
  blocked_at: string | null
  blocked_reason: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type TaskSummary = Pick<
  Task,
  'id' | 'project_id' | 'title' | 'status' | 'priority' | 'assignee_id' | 'due_at'
>

