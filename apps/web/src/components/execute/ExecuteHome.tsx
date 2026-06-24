'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'

import { BriefHero } from '@/components/execute/BriefHero'
import { NextActionCard } from '@/components/execute/NextActionCard'
import { ProjectsPulse } from '@/components/execute/ProjectsPulse'
import { TodayList } from '@/components/execute/TodayList'
import { AppShell } from '@/components/shell/AppShell'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import type { PlannerToday } from '@/lib/momentum/planner/planner-service'

const EMPTY_PLAN: PlannerToday = {
  generated_at: new Date(0).toISOString(),
  next_action: null,
  sections: {
    overdue: [],
    due_today: [],
    in_progress: [],
    blocked: [],
  },
  projects: [],
  brief: {
    headline: 'Set up your execution workspace.',
    narrative: 'Create a project and add a few tasks to turn Momentum AI into your execution cockpit.',
    metrics: {
      open_tasks: 0,
      due_today: 0,
      overdue: 0,
      blocked: 0,
      completed: 0,
      active_projects: 0,
    },
  },
}

export function ExecuteHome() {
  const [plan, setPlan] = useState<PlannerToday>(EMPTY_PLAN)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadPlanner() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/planner/today', { cache: 'no-store' })
      const payload = await readResponsePayload<PlannerToday | { error: string }>(response)

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, 'Could not load today.'))
      }

      setPlan(payload as PlannerToday)
    } catch (caught) {
      setPlan(EMPTY_PLAN)
      setError(caught instanceof Error ? caught.message : 'Could not load today.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPlanner()
  }, [])

  return (
    <AppShell>
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {error && (
            <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[#f1d3c8] bg-[#fff7f3] p-4 text-sm text-[#7f3d2b] sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </span>
              <button
                type="button"
                onClick={() => void loadPlanner()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#9a5b2b] shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-[#eadfce] bg-white/62">
              <Loader2 className="h-6 w-6 animate-spin text-[#9a5b2b]" />
            </div>
          ) : (
            <div className="space-y-6">
              <BriefHero brief={plan.brief} />
              <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="space-y-6">
                  <NextActionCard task={plan.next_action} />
                  <TodayList sections={plan.sections} />
                </div>
                <ProjectsPulse projects={plan.projects} />
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  )
}
