'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, CircleDot, Clock3, Loader2, PlayCircle, ShieldAlert } from 'lucide-react'

import { AppShell } from '@/components/shell/AppShell'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import type { PlannerProjectPulse, PlannerTask, PlannerToday } from '@/lib/momentum/planner/planner-service'

const SECTION_META: Record<
  keyof PlannerToday['sections'],
  {
    label: string
    icon: typeof AlertCircle
    tone: string
  }
> = {
  overdue: { label: 'Overdue', icon: AlertCircle, tone: 'bg-[#fff4f2] text-[#b42318]' },
  due_today: { label: 'Due today', icon: Clock3, tone: 'bg-[#fff7ed] text-[#b54708]' },
  in_progress: { label: 'In progress', icon: PlayCircle, tone: 'bg-[#eff8ff] text-[#175cd3]' },
  blocked: { label: 'Blocked', icon: ShieldAlert, tone: 'bg-[#fef3f2] text-[#d92d20]' },
}

function formatDue(value: string | null) {
  if (!value) return 'No due date'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

function priorityClass(priority: PlannerTask['priority']) {
  if (priority === 'urgent') return 'bg-[#fff4f2] text-[#b42318]'
  if (priority === 'high') return 'bg-[#fff7ed] text-[#b54708]'
  if (priority === 'low') return 'bg-[#ecfdf3] text-[#027a48]'
  return 'bg-[#eff8ff] text-[#175cd3]'
}

function attentionClass(attention: PlannerProjectPulse['attention']) {
  if (attention === 'overdue') return 'bg-[#fff4f2] text-[#b42318]'
  if (attention === 'blocked') return 'bg-[#fef3f2] text-[#d92d20]'
  if (attention === 'due_today') return 'bg-[#fff7ed] text-[#b54708]'
  return 'bg-[#ecfdf3] text-[#027a48]'
}

function TaskCard({ task }: { task: PlannerTask }) {
  return (
    <Link
      href={`/projects/${task.project_id}`}
      className="block rounded-2xl border border-[#d0d5dd] bg-white p-4 transition hover:border-[#98a2b3] hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#101828]">{task.title}</p>
          <p className="mt-1 truncate text-xs text-[#475467]">{task.project_title}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${priorityClass(task.priority)}`}>
          {task.priority}
        </span>
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
      {task.blocked_reason ? <p className="mt-3 text-xs leading-5 text-[#b42318]">Blocked: {task.blocked_reason}</p> : null}
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
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="fluent-kicker">Planner</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#101828]">My work for today</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#475467]">
              {planner?.brief.narrative ?? 'A structured view of due work, active work, blocked work, and the next best move.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Open tasks', value: planner?.brief.metrics.open_tasks ?? '—' },
              { label: 'Due today', value: planner?.brief.metrics.due_today ?? '—' },
              { label: 'Overdue', value: planner?.brief.metrics.overdue ?? '—' },
              { label: 'Blocked', value: planner?.brief.metrics.blocked ?? '—' },
            ].map((metric) => (
              <div key={metric.label} className="fluent-panel min-w-[132px] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">{metric.label}</p>
                <p className="mt-1 text-2xl font-semibold text-[#101828]">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="fluent-panel mt-6 flex min-h-[320px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#0f6cbd]" />
          </div>
        ) : error ? (
          <div className="fluent-panel mt-6 border-[#f1c0c0] bg-[#fff8f8] p-5 text-sm text-[#b42318]">
            Planner data is unavailable right now. Refresh after your project data is back online.
          </div>
        ) : planner ? (
          <>
            <section className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="fluent-panel overflow-hidden">
                <div className="border-b border-[#eaecf0] px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Next action</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#101828]">
                    {planner.next_action ? planner.next_action.title : 'No task selected yet'}
                  </h2>
                </div>
                <div className="px-5 py-5">
                  {planner.next_action ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-[#475467]">
                        <span className="rounded-full bg-[#eff8ff] px-3 py-1 font-medium text-[#175cd3]">{planner.next_action.project_title}</span>
                        <span className={`rounded-full px-3 py-1 font-medium capitalize ${priorityClass(planner.next_action.priority)}`}>
                          {planner.next_action.priority}
                        </span>
                        <span>Due {formatDue(planner.next_action.due_at)}</span>
                      </div>
                      <p className="mt-4 max-w-3xl text-sm leading-6 text-[#475467]">
                        {planner.next_action.blocked_reason
                          ? `This task is blocked by: ${planner.next_action.blocked_reason}`
                          : planner.next_action.description || 'Open the project workspace to update details, status, and dates.'}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <Link href={`/projects/${planner.next_action.project_id}`} className="fluent-button">
                          Open project
                        </Link>
                        <Link href="/projects" className="fluent-button-secondary">
                          Browse all projects
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#d0d5dd] bg-[#f8fafc] p-5 text-sm text-[#475467]">
                      No next action is available yet. Create or date tasks inside a project and this area will start steering the day.
                    </div>
                  )}
                </div>
              </div>

              <div className="fluent-panel">
                <div className="border-b border-[#eaecf0] px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Project pulse</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#101828]">Where attention is needed</h2>
                </div>
                <div className="max-h-[340px] space-y-3 overflow-auto px-5 py-5">
                  {planner.projects.length ? planner.projects.slice(0, 6).map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="block rounded-2xl border border-[#d0d5dd] bg-white p-4 transition hover:border-[#98a2b3]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#101828]">{project.title}</p>
                          <p className="mt-1 text-xs text-[#667085]">
                            {project.open_tasks} open, {project.completed_tasks} done
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${attentionClass(project.attention)}`}>
                          {project.attention.replace('_', ' ')}
                        </span>
                      </div>
                    </Link>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-[#d0d5dd] bg-[#f8fafc] p-4 text-sm text-[#475467]">
                      Project attention will appear here once you have active work in the portfolio.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-5 2xl:grid-cols-2">
              {sectionKeys.map((key) => {
                const meta = SECTION_META[key]
                const Icon = meta.icon
                const tasks = planner.sections[key]

                return (
                  <div key={key} className="fluent-panel overflow-hidden">
                    <div className="flex items-center justify-between border-b border-[#eaecf0] px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-xl p-2 ${meta.tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-[#101828]">{meta.label}</h2>
                          <p className="text-xs text-[#667085]">{tasks.length} task{tasks.length === 1 ? '' : 's'}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-xs font-semibold text-[#475467]">{tasks.length}</span>
                    </div>
                    <div className="space-y-3 px-5 py-5">
                      {tasks.length ? tasks.map((task) => <TaskCard key={task.id} task={task} />) : (
                        <div className="rounded-2xl border border-dashed border-[#d0d5dd] bg-[#f8fafc] p-4 text-sm text-[#475467]">
                          Nothing in {meta.label.toLowerCase()} right now.
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </section>

            {totalTasks === 0 ? (
              <div className="fluent-panel mt-6 flex flex-col items-center justify-center gap-3 border-dashed px-8 py-14 text-center">
                <CircleDot className="h-7 w-7 text-[#98a2b3]" />
                <div>
                  <p className="text-lg font-semibold text-[#101828]">No tasks need attention today.</p>
                  <p className="mt-1 text-sm text-[#667085]">Add due dates or start a task from a project and your planner will begin to organize the day.</p>
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
