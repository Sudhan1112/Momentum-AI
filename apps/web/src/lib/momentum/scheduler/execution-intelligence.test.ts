import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { PlannerToday } from '@/lib/momentum/planner/planner-service'
import type { RecoveryAction } from '@/lib/momentum/recovery-service'
import type { ProjectListItem } from '@/types/project'
import type { TaskItem, TaskPriority, TaskStatus } from '@/types/task'
import { buildDeterministicExecutionPlan, type ExecutionProjectInput } from './execution-intelligence'

const SCHEDULE_DATE = '2026-06-27'

function project(id = '10000000-0000-4000-8000-000000000001'): ProjectListItem {
  return {
    id,
    title: 'Launch Momentum',
    description: null,
    owner_id: '20000000-0000-4000-8000-000000000001',
    status: 'active',
    target_deadline: '2026-07-10T17:00:00.000Z',
    goal_summary: 'Ship the launch',
    execution_target_score: 80,
    created_at: '2026-06-01T09:00:00.000Z',
    updated_at: '2026-06-26T09:00:00.000Z',
    owner: null,
    members: [],
    task_counts: { total: 0, open: 0, done: 0, blocked: 0, overdue: 0 },
  }
}

function task(input: {
  id: string
  title: string
  status?: TaskStatus
  priority?: TaskPriority
  due_at?: string | null
  estimate_minutes?: number | null
  blocked_reason?: string | null
  project_id?: string
}): TaskItem {
  return {
    id: input.id,
    project_id: input.project_id ?? project().id,
    title: input.title,
    description: null,
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium',
    assignee_id: null,
    due_at: input.due_at ?? null,
    started_at: null,
    completed_at: null,
    estimate_minutes: input.estimate_minutes ?? 60,
    actual_minutes: null,
    sort_order: 0,
    blocked_at: input.status === 'blocked' ? '2026-06-25T09:00:00.000Z' : null,
    blocked_reason: input.blocked_reason ?? null,
    created_by: '20000000-0000-4000-8000-000000000001',
    created_at: '2026-06-01T09:00:00.000Z',
    updated_at: '2026-06-26T09:00:00.000Z',
    assignee: null,
  }
}

function planner(nextActionId: string | null = null): PlannerToday {
  return {
    generated_at: '2026-06-27T09:00:00.000Z',
    next_action: nextActionId ? ({ id: nextActionId } as PlannerToday['next_action']) : null,
    sections: { overdue: [], due_today: [], in_progress: [], blocked: [] },
    projects: [],
    brief: {
      headline: 'Today is ready to execute.',
      narrative: 'Keep the day narrow and clear the highest-pressure work first.',
      metrics: { open_tasks: 0, due_today: 0, overdue: 0, blocked: 0, completed: 0, active_projects: 1 },
    },
  }
}

function entry(tasks: TaskItem[], recoveryActions: RecoveryAction[] = [], simulationProbability: number | null = null): ExecutionProjectInput {
  return {
    project: project(),
    tasks,
    recovery_actions: recoveryActions,
    simulation_probability: simulationProbability,
  }
}

function build(projects: ExecutionProjectInput[], productiveMinutes = 240, nextActionId: string | null = null) {
  return buildDeterministicExecutionPlan({
    projects,
    planner: planner(nextActionId),
    schedule_date: SCHEDULE_DATE,
    productive_minutes: productiveMinutes,
  })
}

describe('Momentum Flow execution intelligence', () => {
  it('prioritizes overdue high-impact work deterministically', () => {
    const overdue = task({
      id: '30000000-0000-4000-8000-000000000001',
      title: 'Fix OAuth callback',
      priority: 'urgent',
      due_at: '2026-06-25T17:00:00.000Z',
    })
    const later = task({
      id: '30000000-0000-4000-8000-000000000002',
      title: 'Polish documentation',
      priority: 'low',
      due_at: '2026-07-20T17:00:00.000Z',
    })

    const result = build([entry([later, overdue])])

    expect(result.todays_focus[0].task_id).toBe(overdue.id)
    expect(result.todays_focus[0].reason).toContain('Overdue by 2 days')
    expect(result.todays_focus[0].score).toBeGreaterThan(result.todays_focus[1].score)
  })

  it('never turns blocked work into a focus task and explains how to unblock it', () => {
    const blocked = task({
      id: '30000000-0000-4000-8000-000000000003',
      title: 'Deploy release',
      status: 'blocked',
      priority: 'urgent',
      blocked_reason: 'Production credentials are missing',
    })
    const ready = task({
      id: '30000000-0000-4000-8000-000000000004',
      title: 'Complete regression tests',
      priority: 'high',
    })

    const result = build([entry([blocked, ready])])

    expect(result.todays_focus.map((item) => item.task_id)).toEqual([ready.id])
    expect(result.blockers[0]).toMatchObject({
      task_id: blocked.id,
      title: 'Deploy release',
    })
    expect(result.blockers[0].unblock_action).toContain('Production credentials are missing')
  })

  it('only labels evidence-backed low-pressure work as safe to ignore', () => {
    const focus = task({
      id: '30000000-0000-4000-8000-000000000005',
      title: 'Finish launch page',
      priority: 'urgent',
      due_at: '2026-06-27T17:00:00.000Z',
      estimate_minutes: 180,
    })
    const safe = task({
      id: '30000000-0000-4000-8000-000000000006',
      title: 'Tidy internal notes',
      priority: 'low',
      due_at: '2026-07-20T17:00:00.000Z',
      estimate_minutes: 120,
    })
    const pressured = task({
      id: '30000000-0000-4000-8000-000000000007',
      title: 'Review release checklist',
      priority: 'high',
      due_at: '2026-06-28T17:00:00.000Z',
      estimate_minutes: 120,
    })

    const result = build([entry([focus, safe, pressured])], 180)

    expect(result.ignore_today.map((item) => item.task_id)).toContain(safe.id)
    expect(result.ignore_today.map((item) => item.task_id)).not.toContain(pressured.id)
    expect(result.ignore_today.find((item) => item.task_id === safe.id)?.reason).toContain('Low impact today')
  })

  it('respects productive capacity without inventing work', () => {
    const tasks = [
      task({ id: '30000000-0000-4000-8000-000000000008', title: 'First', priority: 'urgent', estimate_minutes: 90 }),
      task({ id: '30000000-0000-4000-8000-000000000009', title: 'Second', priority: 'high', estimate_minutes: 90 }),
      task({ id: '30000000-0000-4000-8000-000000000010', title: 'Third', priority: 'medium', estimate_minutes: 90 }),
    ]

    const result = build([entry(tasks)], 180)

    expect(result.context.selected_minutes).toBeLessThanOrEqual(180)
    expect(result.todays_focus).toHaveLength(2)
    expect(result.todays_focus.every((item) => tasks.some((candidate) => candidate.id === item.task_id))).toBe(true)
  })

  it('uses recovery and simulation only as deterministic pressure signals', () => {
    const recoveryTask = task({
      id: '30000000-0000-4000-8000-000000000011',
      title: 'Stabilize authentication',
      priority: 'medium',
    })
    const peer = task({
      id: '30000000-0000-4000-8000-000000000012',
      title: 'Refine settings',
      priority: 'medium',
    })
    const action: RecoveryAction = {
      id: `reprioritize_task:${recoveryTask.id}`,
      type: 'reprioritize_task',
      task_id: recoveryTask.id,
      task_title: recoveryTask.title,
      reason: 'High risk',
      impact: 'Restore momentum',
    }

    const result = build([entry([peer, recoveryTask], [action], 40)])

    expect(result.todays_focus[0].task_id).toBe(recoveryTask.id)
    expect(result.todays_focus[0].reason).toContain('recovery recommendation')
    expect(result.context.simulation_probability).toBe(40)
    expect(result.context.recovery_actions_considered).toBe(1)
  })

  it('returns a usable empty plan when no open work exists', () => {
    const completed = task({
      id: '30000000-0000-4000-8000-000000000013',
      title: 'Already done',
      status: 'done',
    })

    const result = build([entry([completed])])

    expect(result.todays_focus).toEqual([])
    expect(result.blockers).toEqual([])
    expect(result.daily_summary).toEqual(['No open work needs execution guidance today.'])
    expect(result.confidence).toBe(100)
    expect(result.context.momentum_score).toBe(100)
    expect(result.highest_impact_action).toBeNull()
  })

  it('builds a stable next-action chain from the deterministic order', () => {
    const first = task({ id: '30000000-0000-4000-8000-000000000014', title: 'First action', priority: 'urgent' })
    const second = task({ id: '30000000-0000-4000-8000-000000000015', title: 'Second action', priority: 'high' })

    const result = build([entry([second, first])])

    expect(result.todays_focus[0].next_best_action).toBe('Move directly to Second action.')
    expect(result.todays_focus[1].next_best_action).toContain('Regenerate the plan')
  })

  it('surfaces the hero action and a short-session quick win deterministically', () => {
    const hero = task({
      id: '30000000-0000-4000-8000-000000000016',
      title: 'Ship onboarding',
      priority: 'urgent',
      due_at: '2026-06-27T17:00:00.000Z',
      estimate_minutes: 120,
    })
    const quick = task({
      id: '30000000-0000-4000-8000-000000000017',
      title: 'Review client notes',
      priority: 'medium',
      estimate_minutes: 30,
    })

    const result = build([entry([quick, hero])], 120)

    expect(result.highest_impact_action?.task_id).toBe(hero.id)
    expect(result.quick_win?.task_id).toBe(quick.id)
    expect(result.context.momentum_score).toBeGreaterThan(0)
    expect(result.context.momentum_label).toMatch(/low|medium|high/)
  })
})
