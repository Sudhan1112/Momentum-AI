'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Bot, BrainCircuit, Loader2, Sparkles, Target } from 'lucide-react'

import { AppShell } from '@/components/shell/AppShell'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import type { MomentumDailyBrief } from '@/lib/momentum/ai/capabilities/morning-brief'

function healthTone(level: MomentumDailyBrief['workspace_health']['level']) {
  if (level === 'healthy') return 'bg-[#ecfdf3] text-[#027a48]'
  if (level === 'critical') return 'bg-[#fff4f2] text-[#b42318]'
  return 'bg-[#fff7ed] text-[#b54708]'
}

function scoreTone(score: number) {
  if (score >= 80) return 'text-[#027a48]'
  if (score >= 60) return 'text-[#175cd3]'
  if (score >= 40) return 'text-[#b54708]'
  return 'text-[#b42318]'
}

export default function MomentumPage() {
  const [brief, setBrief] = useState<MomentumDailyBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadBrief() {
      setLoading(true)
      setError(false)
      const response = await fetch('/api/momentum/brief', { cache: 'no-store' })
      const payload = await readResponsePayload<MomentumDailyBrief | { error: string }>(response)
      if (!mounted) return

      if (!response.ok) {
        console.warn(getResponseErrorMessage(payload, 'Could not load Momentum.'))
        setError(true)
        setBrief(null)
      } else {
        setBrief(payload as MomentumDailyBrief)
      }
      setLoading(false)
    }

    void loadBrief()

    return () => {
      mounted = false
    }
  }, [])

  return (
    <AppShell>
      <main className="fluent-page pb-24">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="fluent-kicker">Momentum AI</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#101828]">Execution intelligence</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#475467]">
              Daily brief, workspace health, risk signals, and the AI-backed recommendation layer for the whole portfolio.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/planner" className="fluent-button-secondary">Open planner</Link>
            <Link href="/projects" className="fluent-button">
              View projects
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="fluent-panel mt-6 flex min-h-[320px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#0f6cbd]" />
          </div>
        ) : error ? (
          <div className="fluent-panel mt-6 border-[#f1c0c0] bg-[#fff8f8] p-5 text-sm text-[#b42318]">
            Momentum data is unavailable right now. Refresh after the AI and project services are reachable.
          </div>
        ) : brief ? (
          <>
            <section className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="fluent-panel overflow-hidden">
                <div className="border-b border-[#eaecf0] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-[linear-gradient(135deg,#0f6cbd_0%,#115ea3_100%)] p-3 text-white shadow-[0_12px_28px_rgba(15,108,189,0.24)]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Latest brief</p>
                      <h2 className="text-xl font-semibold text-[#101828]">{brief.welcome}</h2>
                    </div>
                  </div>
                </div>
                <div className="grid gap-5 px-5 py-5 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-[#dce6f6] bg-[radial-gradient(circle_at_top,#eff8ff_0%,#f8fbff_60%,#ffffff_100%)] p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#175cd3]">Execution score</p>
                      <p className={`mt-3 text-5xl font-semibold tracking-tight ${scoreTone(brief.execution_score.score)}`}>{brief.execution_score.score}</p>
                      <p className="mt-3 text-sm leading-6 text-[#475467]">{brief.execution_score.explanation}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${healthTone(brief.workspace_health.level)}`}>
                        {brief.workspace_health.label}
                      </span>
                      <span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-xs font-semibold text-[#475467]">
                        {brief.mode === 'ai' ? 'AI-generated' : 'Deterministic fallback'}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm text-[#475467]">
                      {brief.workspace_health.reasons.map((reason) => (
                        <div key={reason} className="rounded-xl border border-[#eaecf0] bg-[#f8fafc] px-3 py-2">
                          {reason}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[#d0d5dd] bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Momentum suggests</p>
                      <p className="mt-2 text-lg font-semibold text-[#101828]">{brief.recommendation.summary}</p>
                      <p className="mt-2 text-sm leading-6 text-[#475467]">{brief.recommendation.reasoning}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Open tasks', value: brief.metrics.open_tasks },
                        { label: 'Overdue', value: brief.metrics.overdue },
                        { label: 'Blocked', value: brief.metrics.blocked },
                        { label: 'At risk', value: brief.at_risk_tasks.length },
                      ].map((metric) => (
                        <div key={metric.label} className="rounded-2xl border border-[#eaecf0] bg-[#f8fafc] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">{metric.label}</p>
                          <p className="mt-1 text-2xl font-semibold text-[#101828]">{metric.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="fluent-panel">
                  <div className="border-b border-[#eaecf0] px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-[#0f6cbd]" />
                      <h2 className="text-base font-semibold text-[#101828]">AI run trace</h2>
                    </div>
                  </div>
                  <div className="space-y-3 px-5 py-5 text-sm text-[#475467]">
                    <div className="rounded-2xl border border-[#eaecf0] bg-[#f8fafc] p-4">
                      <p className="font-semibold text-[#101828]">Daily brief engine</p>
                      <p className="mt-1">{brief.mode === 'ai' ? 'AI run completed with stored citations.' : 'AI result unavailable, deterministic guidance shown instead.'}</p>
                    </div>
                    <div className="rounded-2xl border border-[#eaecf0] bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Run ID</p>
                      <p className="mt-2 break-all text-xs text-[#475467]">{brief.ai_run_id ?? 'No AI run id was returned for this brief.'}</p>
                    </div>
                    <div className="rounded-2xl border border-[#eaecf0] bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Citation count</p>
                      <p className="mt-2 text-xl font-semibold text-[#101828]">{brief.citations.length}</p>
                    </div>
                  </div>
                </div>

                <div className="fluent-panel">
                  <div className="border-b border-[#eaecf0] px-5 py-4">
                    <div className="flex items-center gap-2">
                      <BrainCircuit className="h-4 w-4 text-[#0f6cbd]" />
                      <h2 className="text-base font-semibold text-[#101828]">AI workflows</h2>
                    </div>
                  </div>
                  <div className="space-y-3 px-5 py-5">
                    <Link href="/projects" className="block rounded-2xl border border-[#d0d5dd] bg-white p-4 transition hover:border-[#98a2b3]">
                      <p className="font-semibold text-[#101828]">Task extraction</p>
                      <p className="mt-1 text-sm text-[#475467]">Open a project to turn notes, meetings, or messy text into reviewable task proposals.</p>
                    </Link>
                    <Link href="/projects" className="block rounded-2xl border border-[#d0d5dd] bg-white p-4 transition hover:border-[#98a2b3]">
                      <p className="font-semibold text-[#101828]">Recovery planning</p>
                      <p className="mt-1 text-sm text-[#475467]">Review recovery options when a project score drops or blockers start stacking up.</p>
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-5 2xl:grid-cols-3">
              <div className="fluent-panel overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#eaecf0] px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#0f6cbd]" />
                    <h2 className="text-base font-semibold text-[#101828]">Top priorities</h2>
                  </div>
                  <span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-xs font-semibold text-[#475467]">{brief.top_priorities.length}</span>
                </div>
                <div className="space-y-3 px-5 py-5">
                  {brief.top_priorities.length ? brief.top_priorities.map((task) => (
                    <Link key={task.id} href={`/projects/${task.project_id}`} className="block rounded-2xl border border-[#d0d5dd] bg-white p-4 transition hover:border-[#98a2b3]">
                      <p className="text-sm font-semibold text-[#101828]">{task.title}</p>
                      <p className="mt-1 text-xs text-[#667085]">{task.project_title}</p>
                      <p className="mt-2 text-sm text-[#475467]">{task.reason}</p>
                    </Link>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-[#d0d5dd] bg-[#f8fafc] p-4 text-sm text-[#475467]">No priority tasks were returned.</div>
                  )}
                </div>
              </div>

              <div className="fluent-panel overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#eaecf0] px-5 py-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#b42318]" />
                    <h2 className="text-base font-semibold text-[#101828]">At-risk tasks</h2>
                  </div>
                  <span className="rounded-full bg-[#fff4f2] px-3 py-1 text-xs font-semibold text-[#b42318]">{brief.at_risk_tasks.length}</span>
                </div>
                <div className="space-y-3 px-5 py-5">
                  {brief.at_risk_tasks.length ? brief.at_risk_tasks.map((risk) => (
                    <Link key={risk.task_id} href={`/projects/${risk.project_id}`} className="block rounded-2xl border border-[#f1c0c0] bg-[#fffafa] p-4 transition hover:border-[#e0a7a7]">
                      <p className="text-sm font-semibold text-[#101828]">{risk.task_title}</p>
                      <p className="mt-1 text-xs text-[#667085]">{risk.project_title || 'Project task'}</p>
                      <p className="mt-2 text-sm text-[#b42318]">{risk.reason}</p>
                    </Link>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-[#d0d5dd] bg-[#f8fafc] p-4 text-sm text-[#475467]">No at-risk tasks right now.</div>
                  )}
                </div>
              </div>

              <div className="fluent-panel overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#eaecf0] px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#0f6cbd]" />
                    <h2 className="text-base font-semibold text-[#101828]">Today&apos;s plan</h2>
                  </div>
                  <span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-xs font-semibold text-[#475467]">{brief.todays_plan.length}</span>
                </div>
                <div className="space-y-3 px-5 py-5">
                  {brief.todays_plan.length ? brief.todays_plan.map((task) => (
                    <Link key={task.id} href={`/projects/${task.project_id}`} className="block rounded-2xl border border-[#d0d5dd] bg-white p-4 transition hover:border-[#98a2b3]">
                      <p className="text-sm font-semibold text-[#101828]">{task.title}</p>
                      <p className="mt-1 text-xs text-[#667085]">{task.project_title}</p>
                      <p className="mt-2 text-sm text-[#475467]">{task.reason}</p>
                    </Link>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-[#d0d5dd] bg-[#f8fafc] p-4 text-sm text-[#475467]">No plan items were returned.</div>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </AppShell>
  )
}
