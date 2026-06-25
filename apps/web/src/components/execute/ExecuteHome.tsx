'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'

import { BriefHero } from '@/components/execute/BriefHero'
import { AtRiskList } from '@/components/execute/AtRiskList'
import { ExecutionScoreRing } from '@/components/execute/ExecutionScoreRing'
import { NextActionCard } from '@/components/execute/NextActionCard'
import { ProjectsPulse } from '@/components/execute/ProjectsPulse'
import { TodayList } from '@/components/execute/TodayList'
import { WorkspaceHealthIndicator } from '@/components/execute/WorkspaceHealthIndicator'
import { AppShell } from '@/components/shell/AppShell'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import type { MomentumDailyBrief } from '@/lib/momentum/ai/capabilities/morning-brief'
import type { WorkspaceExecutionScore } from '@/lib/momentum/execution-score'
import type { WorkspaceHealthSnapshot } from '@/lib/momentum/health-snapshot'
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

type MomentumExecutionResponse = {
  execution_score: WorkspaceExecutionScore
  health: WorkspaceHealthSnapshot
}

export function ExecuteHome() {
  const [plan, setPlan] = useState<PlannerToday>(EMPTY_PLAN)
  const [intelligence, setIntelligence] = useState<MomentumExecutionResponse | null>(null)
  const [dailyBrief, setDailyBrief] = useState<MomentumDailyBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadDashboard() {
    setLoading(true)
    setError(null)

    try {
      const [plannerResponse, scoreResponse, briefResponse] = await Promise.all([
        fetch('/api/planner/today', { cache: 'no-store' }),
        fetch('/api/momentum/execution-score', { cache: 'no-store' }),
        fetch('/api/momentum/brief', { cache: 'no-store' }),
      ])
      const plannerPayload = await readResponsePayload<PlannerToday | { error: string }>(plannerResponse)
      const scorePayload = await readResponsePayload<MomentumExecutionResponse | { error: string }>(scoreResponse)
      const briefPayload = await readResponsePayload<MomentumDailyBrief | { error: string }>(briefResponse)

      if (!plannerResponse.ok) {
        throw new Error(getResponseErrorMessage(plannerPayload, 'Could not load today.'))
      }

      if (!scoreResponse.ok) {
        throw new Error(getResponseErrorMessage(scorePayload, 'Could not load execution intelligence.'))
      }

      setPlan(plannerPayload as PlannerToday)
      setIntelligence(scorePayload as MomentumExecutionResponse)
      setDailyBrief(briefResponse.ok ? (briefPayload as MomentumDailyBrief) : null)
    } catch (caught) {
      setPlan(EMPTY_PLAN)
      setIntelligence(null)
      setDailyBrief(null)
      setError(caught instanceof Error ? caught.message : 'Could not load today.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
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
                onClick={() => void loadDashboard()}
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
              <BriefHero brief={dailyBrief ?? plan.brief} />
              {intelligence && (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <section className="rounded-2xl border border-[#eadfce] bg-white/76 p-6 shadow-[0_18px_44px_rgba(83,67,48,0.06)]">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Execution score</p>
                    <div className="mt-5">
                      <ExecutionScoreRing score={intelligence.execution_score.score} />
                    </div>
                    <p className="mt-5 text-sm leading-6 text-[#6b5f52]">{intelligence.execution_score.explanation}</p>
                  </section>
                  <WorkspaceHealthIndicator health={intelligence.health} />
                </div>
              )}
              <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="space-y-6">
                  <NextActionCard task={plan.next_action} />
                  <TodayList sections={plan.sections} />
                </div>
                <div className="space-y-6">
                  {intelligence && <AtRiskList risks={intelligence.execution_score.top_risks} />}
                  <ProjectsPulse projects={plan.projects} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  )
}
