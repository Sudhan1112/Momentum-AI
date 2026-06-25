'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, CircleDot, Loader2 } from 'lucide-react'

import { MomentumFlowPanel } from '@/components/momentum-flow/MomentumFlowPanel'
import { AppShell } from '@/components/shell/AppShell'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import type { PlannerTask, PlannerToday } from '@/lib/momentum/planner/planner-service'

const SECTION_LABELS: Record<keyof PlannerToday['sections'], string> = {
  overdue: 'Overdue',
  due_today: 'Due today',
  in_progress: 'In progress',
  blocked: 'Blocked',
}

function formatDue(value: string | null) {
  if (!value) return 'No due date'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

function priorityClass(priority: PlannerTask['priority']) {
  if (priority === 'urgent') return 'bg-[#fff0ea] text-[#a33a2b]'
  if (priority === 'high') return 'bg-[#fff6dc] text-[#8a5b00]'
  if (priority === 'low') return 'bg-[#eef5f0] text-[#2f6b4f]'
  return 'bg-[#f3ede2] text-[#6b5f52]'
}

function TaskRow({ task }: { task: PlannerTask }) {
  return (
    <Link
      href={`/projects/${task.project_id}`}
      className="block rounded-2xl border border-[#eadfce] bg-white p-4 transition hover:border-[#d8c5aa]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[#2d241c]">{task.title}</p>
          <p className="mt-1 text-sm text-[#6b5f52]">{task.project_title}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${priorityClass(task.priority)}`}>
          {task.priority}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#8a7f72]">
        <span>{formatDue(task.due_at)}</span>
        <span className="h-1 w-1 rounded-full bg-[#cbbba4]" />
        <span className="capitalize">{task.status.replace(/_/g, ' ')}</span>
      </div>
      {task.blocked_reason && <p className="mt-3 text-sm leading-5 text-[#8a4b2b]">Blocked: {task.blocked_reason}</p>}
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

  return (
    <AppShell>
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#7b746b] hover:text-[#9a5b2b]">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <section className="mt-5 rounded-[32px] border border-[#eadfce] bg-white/76 p-7 shadow-[0_18px_44px_rgba(83,67,48,0.06)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f3ede2] text-[#9a5b2b]">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Planner</p>
                <h1 className="mt-3 text-4xl font-light tracking-tight text-[#2d241c]" style={{ fontFamily: 'Newsreader, Georgia, serif' }}>
                  Today
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6b5f52]">
                  {planner?.brief.narrative ?? 'A focused view of overdue, due today, active, and blocked work.'}
                </p>
              </div>
              {planner && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Object.entries(planner.brief.metrics).slice(0, 4).map(([key, value]) => (
                    <div key={key} className="rounded-2xl bg-[#fbf7f0] px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7f72]">{key.replace(/_/g, ' ')}</p>
                      <p className="mt-1 text-2xl font-semibold text-[#2d241c]">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="mt-8">
            <MomentumFlowPanel />
          </div>

          {loading ? (
            <div className="mt-8 flex min-h-72 items-center justify-center rounded-[28px] border border-[#eadfce] bg-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-[#9a5b2b]" />
            </div>
          ) : error ? (
            <div className="mt-8 rounded-2xl border border-[#eadfce] bg-[#fbf7f0] p-5 text-sm text-[#6b5f52]">
              Today planner is unavailable. Check project setup, then refresh.
            </div>
          ) : planner && totalTasks > 0 ? (
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              {(Object.keys(planner.sections) as Array<keyof PlannerToday['sections']>).map((key) => (
                <section key={key} className="rounded-[28px] border border-[#eadfce] bg-white/72 p-5 shadow-[0_16px_40px_rgba(83,67,48,0.05)]">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-[#2d241c]">
                      <CircleDot className="h-4 w-4 text-[#9a5b2b]" />
                      {SECTION_LABELS[key]}
                    </h2>
                    <span className="rounded-full bg-[#f3ede2] px-3 py-1 text-xs font-bold text-[#8a7f72]">{planner.sections[key].length}</span>
                  </div>
                  {planner.sections[key].length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-[#d8c5aa] bg-[#fbf7f0] p-4 text-sm text-[#6b5f52]">
                      Nothing here right now.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {planner.sections[key].map((task) => (
                        <TaskRow key={task.id} task={task} />
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-[28px] border border-dashed border-[#d8c5aa] bg-white/70 p-8 text-center">
              <p className="text-xl font-semibold text-[#2d241c]">No tasks need attention today.</p>
              <p className="mt-2 text-sm text-[#6b5f52]">Add due dates or start a task from a project to populate this planner.</p>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  )
}
