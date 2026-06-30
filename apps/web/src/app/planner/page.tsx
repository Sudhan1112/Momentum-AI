'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  CircleDot,
  Clock3,
  Loader2,
  PlayCircle,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'

import { AppShell } from '@/components/shell/AppShell'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import type { PlannerProjectPulse, PlannerTask, PlannerToday } from '@/lib/momentum/planner/planner-service'

const SECTION_META: Record<
  keyof PlannerToday['sections'],
  {
    label: string
    icon: typeof AlertCircle
    tone: string
    badge: string
  }
> = {
  overdue: {
    label: 'Overdue',
    icon: AlertCircle,
    tone: 'bg-[#fff4f2] text-[#b42318]',
    badge: 'fluent-badge-red',
  },
  due_today: {
    label: 'Due today',
    icon: Clock3,
    tone: 'bg-[#fff7ed] text-[#b54708]',
    badge: 'fluent-badge-amber',
  },
  in_progress: {
    label: 'In progress',
    icon: PlayCircle,
    tone: 'bg-[#eff8ff] text-[#175cd3]',
    badge: 'fluent-badge-blue',
  },
  blocked: {
    label: 'Blocked',
    icon: ShieldAlert,
    tone: 'bg-[#fef3f2] text-[#d92d20]',
    badge: 'fluent-badge-red',
  },
}

function formatDue(value: string | null) {
  if (!value) return 'No due date'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

function priorityClass(priority: PlannerTask['priority']) {
  if (priority === 'urgent') return 'fluent-badge-red'
  if (priority === 'high') return 'fluent-badge-amber'
  if (priority === 'low') return 'fluent-badge-green'
  return 'fluent-badge-blue'
}

function attentionClass(attention: PlannerProjectPulse['attention']) {
  if (attention === 'overdue') return 'fluent-badge-red'
  if (attention === 'blocked') return 'fluent-badge-red'
  if (attention === 'due_today') return 'fluent-badge-amber'
  return 'fluent-badge-green'
}

function TaskCard({ task }: { task: PlannerTask }) {
  return (
    <Link
      href={`/projects/${task.project_id}`}
      className="fluent-card block p-4 transition hover:border-[#98a2b3] hover:bg-[#fbfdff] hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-semibold text-[#101828]">{task.title}</p>
          <p className="truncate text-xs text-[#667085]">{task.project_title}</p>
        </div>
        <span className={`capitalize ${priorityClass(task.priority)}`}>{task.priority}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#667085]">
        <span>{formatDue(task.due_at)}</span>
        <span className="h-1 w-1 rounded-full bg-[#d0d5dd]" />
        <span className="capitalize">{task.status.replace(/_/g, ' ')}</span>
        {task.estimate_minutes ? (
          <>
            <span className="h-1 w-1 rounded-full bg-[#d0d5dd]" />
            <span>{Math.max(1, Math.round(task.estimate_minutes / 60))}h estimate</span>
          </>
        ) : null}
      </div>

      {task.blocked_reason ? (
        <div className="mt-3 rounded-xl border border-[#f1c0c0] bg-[#fff8f7] px-3 py-2 text-xs leading-5 text-[#b42318]">
          Blocked: {task.blocked_reason}
        </div>
      ) : null}
    </Link>
  )
}

export default function PlannerPage() {
  const [planner, setPlanner] = useState<PlannerToday | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadPlanner() {
      setLoading(true)
      setError(false)
      const response = await fetch('/api/planner/today', { cache: 'no-store' })
      const payload = await readResponsePayload<PlannerToday | { error: string }>(response)
      if (!mounted) return

      if (!response.ok) {
        console.warn(getResponseErrorMessage(payload, 'Could not load today.'))
        setError(true)
        setPlanner(null)
      } else {
        setPlanner(payload as PlannerToday)
      }
      setLoading(false)
    }

    void loadPlanner()

    return () => {
      mounted = false
    }
  }, [])

  const totalTasks = useMemo(() => {
    if (!planner) return 0
    return Object.values(planner.sections).reduce((total, tasks) => total + tasks.length, 0)
  }, [planner])

  const sectionKeys = Object.keys(SECTION_META) as Array<keyof PlannerToday['sections']>

  return (
    <AppShell>
      <main className="fluent-page pb-24">
        <div className="workspace-hero flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <p className="fluent-kicker">Planner</p>
            <h1 className="text-[32px] font-semibold tracking-[-0.035em] text-[#101828] sm:text-[38px]">My work for today</h1>
            <p className="max-w-3xl text-sm leading-6 text-[#475467]">
              {planner?.brief.narrative ??
                'A structured view of due work, active work, blocked work, and the next best move.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Open tasks', value: planner?.brief.metrics.open_tasks ?? '—' },
              { label: 'Due today', value: planner?.brief.metrics.due_today ?? '—' },
              { label: 'Overdue', value: planner?.brief.metrics.overdue ?? '—' },
              { label: 'Blocked', value: planner?.brief.metrics.blocked ?? '—' },
            ].map((metric) => (
              <div key={metric.label} className="workspace-stat min-w-[138px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">{metric.label}</p>
                <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#101828]">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="fluent-panel mt-5 flex min-h-[320px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#0f6cbd]" />
          </div>
        ) : error ? (
          <div className="fluent-panel mt-5 border-[#f1c0c0] bg-[#fff8f8] p-5 text-sm text-[#b42318]">
            Planner data is unavailable right now. Refresh after your project data is back online.
          </div>
        ) : planner ? (
          <>
            <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="fluent-panel overflow-hidden">
                <div className="fluent-section-header">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f6cbd_0%,#115ea3_100%)] text-white shadow-[0_12px_24px_rgba(15,108,189,0.18)]">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="fluent-kicker text-[#175cd3]">Next action</p>
                      <h2 className="fluent-section-title">
                        {planner.next_action ? planner.next_action.title : 'No task selected yet'}
                      </h2>
                    </div>
                  </div>
                  {planner.next_action ? (
                    <span className={`capitalize ${priorityClass(planner.next_action.priority)}`}>
                      {planner.next_action.priority}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-4 px-5 py-5">
                  {planner.next_action ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-[#475467]">
                        <span className="fluent-badge-blue">{planner.next_action.project_title}</span>
                        <span className="text-[#667085]">Due {formatDue(planner.next_action.due_at)}</span>
                      </div>
                      <div className="rounded-2xl border border-[#dce6f6] bg-[radial-gradient(circle_at_top,#eff8ff_0%,#f8fbff_58%,#ffffff_100%)] p-4">
                        <p className="text-sm leading-6 text-[#475467]">
                          {planner.next_action.blocked_reason
                            ? `This task is blocked by: ${planner.next_action.blocked_reason}`
                            : planner.next_action.description ||
                              'Open the project workspace to update details, status, and dates.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Link href={`/projects/${planner.next_action.project_id}`} className="fluent-button">
                          Open project
                        </Link>
                        <Link href="/projects" className="fluent-button-secondary">
                          Browse all projects
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="fluent-empty">
                      No next action is available yet. Create or date tasks inside a project and this area will start
                      steering the day.
                    </div>
                  )}
                </div>
              </div>

              <div className="fluent-panel overflow-hidden">
                <div className="fluent-section-header">
                  <div>
                    <p className="fluent-kicker">Project pulse</p>
                    <h2 className="fluent-section-title">Where attention is needed</h2>
                  </div>
                  <span className="fluent-badge-gray">{Math.min(planner.projects.length, 6)} shown</span>
                </div>

                <div className="max-h-[360px] space-y-2.5 overflow-auto px-5 py-5">
                  {planner.projects.length ? (
                    planner.projects.slice(0, 6).map((project) => (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        className="fluent-card block p-4 transition hover:border-[#98a2b3] hover:bg-[#fbfdff]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#101828]">{project.title}</p>
                            <p className="mt-1 text-xs text-[#667085]">
                              {project.open_tasks} open, {project.completed_tasks} done
                            </p>
                          </div>
                          <span className={`capitalize ${attentionClass(project.attention)}`}>
                            {project.attention.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                          <span>{project.overdue_tasks} overdue</span>
                          <span className="h-1 w-1 rounded-full bg-[#d0d5dd]" />
                          <span>{project.blocked_tasks} blocked</span>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="fluent-empty">
                      Project attention will appear here once you have active work in the portfolio.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-5 grid gap-5 2xl:grid-cols-2">
              {sectionKeys.map((key) => {
                const meta = SECTION_META[key]
                const Icon = meta.icon
                const tasks = planner.sections[key]

                return (
                  <div key={key} className="fluent-panel overflow-hidden">
                    <div className="fluent-section-header">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-xl p-2.5 ${meta.tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h2 className="fluent-section-title text-base">{meta.label}</h2>
                          <p className="text-xs text-[#667085]">Work grouped for faster triage</p>
                        </div>
                      </div>
                      <span className={meta.badge}>{tasks.length} task{tasks.length === 1 ? '' : 's'}</span>
                    </div>

                    <div className="space-y-3 px-5 py-5">
                      {tasks.length ? (
                        tasks.map((task) => <TaskCard key={task.id} task={task} />)
                      ) : (
                        <div className="fluent-empty">Nothing in {meta.label.toLowerCase()} right now.</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </section>

            {totalTasks === 0 ? (
              <div className="fluent-panel mt-5 flex flex-col items-center justify-center gap-3 border-dashed px-8 py-14 text-center">
                <CircleDot className="h-7 w-7 text-[#98a2b3]" />
                <div>
                  <p className="text-lg font-semibold text-[#101828]">No tasks need attention today.</p>
                  <p className="mt-1 text-sm text-[#667085]">
                    Add due dates or start a task from a project and your planner will begin to organize the day.
                  </p>
                </div>
                <Link href="/projects" className="fluent-button-secondary">
                  Open projects
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </AppShell>
  )
}
