'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Gauge,
  Loader2,
  Rocket,
  Sparkles,
  Target,
  TimerReset,
} from 'lucide-react'

import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { notify } from '@/lib/notify'
import type { MomentumExecutionPlan } from '@/lib/momentum/scheduler/execution-intelligence'

type MomentumFlowPanelProps = {
  projectId?: string | null
  projectTitle?: string | null
  compact?: boolean
}

function flowError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'code' in payload && payload.code === 'MOMENTUM_FLOW_SETUP_REQUIRED') {
    return 'Today\'s Execution Plan needs the Momentum Flow database patch. Apply supabase/patches/add_momentum_flow.sql, reload the schema, then refresh.'
  }
  return getResponseErrorMessage(payload, fallback)
}

function minutes(value: number) {
  if (value < 60) return `${value}m`
  const hours = Math.round((value / 60) * 10) / 10
  return `${hours}h`
}

function dueLabel(value: string | null) {
  if (!value) return 'No deadline'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid legacy deadline'
  return `Due ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)}`
}

function impactClass(value: string) {
  if (value === 'critical') return 'bg-[#fff0ea] text-[#a33a2b]'
  if (value === 'high') return 'bg-[#fff6dc] text-[#8a5b00]'
  if (value === 'medium') return 'bg-[#f3ede2] text-[#6b5f52]'
  return 'bg-[#eef5f0] text-[#2f6b4f]'
}

function momentumClass(value: MomentumExecutionPlan['context']['momentum_label']) {
  if (value === 'high') return 'bg-[#eef5f0] text-[#2f6b4f]'
  if (value === 'medium') return 'bg-[#fff6dc] text-[#8a5b00]'
  return 'bg-[#fff0ea] text-[#a33a2b]'
}

function PlanMetrics({ plan }: { plan: MomentumExecutionPlan }) {
  const metrics = [
    ['Execution', `${plan.context.execution_score}`],
    ['Health', plan.context.health_label],
    ['Focus load', minutes(plan.context.selected_minutes)],
    ['Confidence', `${plan.confidence}%`],
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map(([label, value]) => (
        <div key={label} className="rounded-2xl bg-[#fbf7f0] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7f72]">{label}</p>
          <p className="mt-1 text-lg font-semibold text-[#2d241c]">{value}</p>
        </div>
      ))}
    </div>
  )
}

export function MomentumFlowPanel({ projectId = null, projectTitle = null, compact = false }: MomentumFlowPanelProps) {
  const [plan, setPlan] = useState<MomentumExecutionPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const todayUrl = useMemo(() => {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
    return `/api/momentum-flow/today${query}`
  }, [projectId])

  const loadToday = useCallback(async () => {
    setLoading(true)
    setError(null)
    const response = await fetch(todayUrl, { cache: 'no-store' })
    const payload = await readResponsePayload<MomentumExecutionPlan | null | { error: string }>(response)
    if (!response.ok) {
      setPlan(null)
      setError(flowError(payload, 'Could not load today\'s execution plan.'))
    } else {
      setPlan(payload as MomentumExecutionPlan | null)
    }
    setLoading(false)
  }, [todayUrl])

  useEffect(() => {
    void loadToday()
  }, [loadToday])

  async function generatePlan() {
    setGenerating(true)
    setError(null)
    const response = await fetch('/api/momentum-flow/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    })
    const payload = await readResponsePayload<MomentumExecutionPlan | { error: string }>(response)
    if (!response.ok) {
      setError(flowError(payload, 'Could not generate today\'s execution plan.'))
    } else {
      setPlan(payload as MomentumExecutionPlan)
      notify.success('Today\'s execution plan is ready')
    }
    setGenerating(false)
  }

  return (
    <section
      id="momentum-flow"
      className={`rounded-[28px] border border-[#e7dece] bg-white/75 shadow-[0_16px_40px_rgba(83,67,48,0.07)] ${
        compact ? 'p-5' : 'p-6'
      }`}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef5f0] text-[#2f6b4f]">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Execution intelligence</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#2d241c]">Today&apos;s Execution Plan</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b5f52]">
            {projectId
              ? `Decide what moves ${projectTitle ?? 'this project'} forward today without creating or rescheduling work.`
              : 'Turn current priorities, risk, recovery, simulation, and capacity into a clear execution order.'}
          </p>
        </div>
        <button
          type="button"
          onClick={generatePlan}
          disabled={generating}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2f6b4f] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#27583f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {plan ? 'Regenerate Today' : 'Generate Today'}
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-[#f1c7b5] bg-[#fff0ea] p-4 text-sm font-semibold text-[#8a3a2d]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-[#d8c5aa] bg-[#fbf7f0]">
          <Loader2 className="h-5 w-5 animate-spin text-[#9a5b2b]" />
        </div>
      ) : !plan ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#d8c5aa] bg-[#fbf7f0] p-5">
          <p className="font-semibold text-[#2d241c]">No execution guidance has been generated today.</p>
          <p className="mt-2 text-sm leading-6 text-[#6b5f52]">
            Generate a plan to rank existing work. Momentum will not create tasks or change dates.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <section className="overflow-hidden rounded-[28px] border border-[#e2d3bb] bg-[radial-gradient(circle_at_top_left,_rgba(255,248,233,0.95),_rgba(244,236,222,0.9)_45%,_rgba(238,245,240,0.82))] p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Good morning</p>
                <h3 className="mt-2 text-3xl font-semibold tracking-tight text-[#2d241c]">
                  Here&apos;s what will move your project forward today.
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b5f52]">
                  Momentum ranks existing work only. It does not create tasks, rewrite dates, or change your schedule.
                </p>
              </div>
              <div className="rounded-3xl bg-white/80 p-4 shadow-[0_10px_30px_rgba(83,67,48,0.08)]">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Today&apos;s Momentum</p>
                <div className="mt-2 flex items-end gap-3">
                  <p className="text-4xl font-semibold tracking-tight text-[#2d241c]">{plan.context.momentum_score}%</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${momentumClass(plan.context.momentum_label)}`}>
                    {plan.context.momentum_label} confidence
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#6b5f52]">
                  {plan.context.momentum_label === 'high'
                    ? 'You can likely finish today\'s plan if you stay narrow.'
                    : plan.context.momentum_label === 'medium'
                      ? 'Today is workable, but interruptions or blockers could reduce follow-through.'
                      : 'Execution risk is elevated today, so keep the day especially tight.'}
                </p>
              </div>
            </div>
          </section>

          <PlanMetrics plan={plan} />

          {plan.highest_impact_action && (
            <section className="rounded-[28px] border border-[#d8e8de] bg-[linear-gradient(135deg,rgba(247,251,248,0.98),rgba(238,245,240,0.92))] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-[#2f6b4f] text-white">
                  <Rocket className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f6b4f]">Highest Impact Action</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl font-semibold tracking-tight text-[#2d241c]">{plan.highest_impact_action.title}</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#2f6b4f] shadow-sm">
                      {minutes(plan.highest_impact_action.estimated_minutes)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#4c6557]">
                    Estimated impact: +{plan.highest_impact_action.expected_score_improvement} execution score
                  </p>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#4c6557]">{plan.highest_impact_action.reason}</p>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-[#d8e8de] bg-[#f7fbf8] p-4">
            <div className="flex items-start gap-3">
              <Gauge className="mt-0.5 h-5 w-5 flex-none text-[#2f6b4f]" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f6b4f]">Momentum coach</p>
                <p className="mt-2 text-sm leading-6 text-[#4c6557]">{plan.coach_summary}</p>
                <p className="mt-2 text-xs text-[#718177]">
                  {plan.mode === 'ai'
                    ? 'AI-polished explanation; deterministic ordering is unchanged.'
                    : 'Deterministic fallback: fully usable without AI.'}
                </p>
              </div>
            </div>
          </section>

          {plan.todays_focus.length > 0 && (
            <section className="rounded-2xl border border-[#eadfce] bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-[#9a5b2b]" />
                <h3 className="text-lg font-semibold text-[#2d241c]">After This...</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#6b5f52]">
                {plan.todays_focus.map((item, index) => (
                  <div key={item.task_id} className="contents">
                    <span className="rounded-full bg-[#fbf7f0] px-3 py-2 text-[#2d241c]">{item.title}</span>
                    {index < plan.todays_focus.length - 1 ? <ArrowRight className="h-4 w-4 text-[#9a5b2b]" /> : null}
                  </div>
                ))}
              </div>
            </section>
          )}

          {plan.quick_win && (
            <section className="rounded-2xl border border-[#eadfce] bg-[#fbf7f0] p-4">
              <div className="flex items-start gap-3">
                <TimerReset className="mt-0.5 h-5 w-5 flex-none text-[#9a5b2b]" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">If You Only Have 30 Minutes</p>
                  <p className="mt-2 text-lg font-semibold text-[#2d241c]">{plan.quick_win.title}</p>
                  <p className="mt-1 text-sm text-[#6b5f52]">{plan.quick_win.project_title}</p>
                  <p className="mt-3 text-sm leading-6 text-[#6b5f52]">{plan.quick_win.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-[#6b5f52]">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {minutes(plan.quick_win.estimated_minutes)}
                    </span>
                    <span>Impact +{plan.quick_win.expected_score_improvement}</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-[#2f6b4f]" />
              <h3 className="text-lg font-semibold text-[#2d241c]">Today&apos;s Focus</h3>
            </div>
            {plan.todays_focus.length === 0 ? (
              <div className="rounded-2xl bg-[#fbf7f0] p-4 text-sm text-[#6b5f52]">No open task needs focus today.</div>
            ) : (
              <div className="space-y-3">
                {plan.todays_focus.map((item) => (
                  <article key={item.task_id} className="rounded-2xl border border-[#eadfce] bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#2f6b4f] text-sm font-bold text-white">
                        {item.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[#2d241c]">{item.title}</p>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${impactClass(item.execution_impact)}`}>
                            {item.execution_impact} impact
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[#8a7f72]">{item.project_title}</p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-[#6b5f52]">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {minutes(item.estimated_minutes)}
                          </span>
                          <span>{dueLabel(item.due_at)}</span>
                          <span>Impact +{item.expected_score_improvement}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#6b5f52]">{item.reason}</p>
                        <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#fbf7f0] p-3 text-sm text-[#6b5f52]">
                          <ArrowRight className="mt-0.5 h-4 w-4 flex-none text-[#9a5b2b]" />
                          <span>
                            <strong className="text-[#2d241c]">Next:</strong> {item.next_best_action}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Ban className="h-4 w-4 text-[#8a7f72]" />
              <h3 className="text-lg font-semibold text-[#2d241c]">Lower Priority Today</h3>
            </div>
            <div className="rounded-2xl border border-[#eadfce] bg-white p-4">
              {plan.ignore_today.length === 0 ? (
                <p className="text-sm text-[#6b5f52]">Nothing is explicitly safe to defer based on current evidence.</p>
              ) : (
                <div className="space-y-3">
                  {plan.ignore_today.map((item) => (
                    <div key={item.task_id} className="border-b border-[#f0e8dc] pb-3 last:border-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#2d241c]">{item.title}</p>
                        <span className="rounded-full bg-[#fbf7f0] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a7f72]">
                          Not recommended today
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#8a7f72]">{item.project_title}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-[#6b5f52]">
                        <span>{dueLabel(item.due_at)}</span>
                        <span>Coach score {item.score}</span>
                      </div>
                      <p className="mt-1 text-sm text-[#6b5f52]">{item.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#a33a2b]" />
              <h3 className="text-lg font-semibold text-[#2d241c]">Blockers</h3>
            </div>
            <div className="space-y-3">
              {plan.blockers.length === 0 ? (
                <div className="rounded-2xl border border-[#d8e8de] bg-[#f7fbf8] p-4 text-sm text-[#4c6557]">No active blockers detected.</div>
              ) : (
                plan.blockers.map((blocker) => (
                  <article key={blocker.task_id} className="rounded-2xl border border-[#f1c7b5] bg-[#fff8f5] p-4">
                    <p className="font-semibold text-[#2d241c]">{blocker.title}</p>
                    <p className="mt-1 text-xs text-[#8a7f72]">{blocker.project_title}</p>
                    <p className="mt-3 text-sm leading-6 text-[#6b5f52]">{blocker.why_it_matters}</p>
                    <p className="mt-2 text-sm leading-6 text-[#6b5f52]">
                      <strong className="text-[#2d241c]">Unblock:</strong> {blocker.unblock_action}
                    </p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[#a33a2b]">
                      Expected execution improvement: +{blocker.expected_execution_improvement}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#eadfce] bg-[#2d241c] p-5 text-white">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#b8d8c5]" />
              <h3 className="text-lg font-semibold">Daily Momentum Summary</h3>
            </div>
            <ol className="mt-4 space-y-2">
              {plan.daily_summary.map((item, index) => (
                <li key={`${index}-${item}`} className="flex gap-3 text-sm leading-6 text-[#eee5d9]">
                  <span className="font-bold text-[#b8d8c5]">{index + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </section>
  )
}
