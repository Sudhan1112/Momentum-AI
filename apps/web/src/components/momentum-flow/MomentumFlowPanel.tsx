'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Loader2, RefreshCw, Wand2 } from 'lucide-react'

import { BacklogRemainingList } from '@/components/momentum-flow/BacklogRemainingList'
import { CapacitySummary } from '@/components/momentum-flow/CapacitySummary'
import { MomentumFlowTimeline } from '@/components/momentum-flow/MomentumFlowTimeline'
import { MomentumFlowWhyPanel } from '@/components/momentum-flow/MomentumFlowWhyPanel'
import { ScheduleInsights } from '@/components/momentum-flow/ScheduleInsights'
import { ScheduleProposalReview } from '@/components/momentum-flow/ScheduleProposalReview'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { notify } from '@/lib/notify'
import type {
  MomentumFlowExplanation,
  MomentumFlowProposal,
  MomentumFlowSession,
  MomentumFlowSessionStatus,
  MomentumFlowToday,
} from '@/lib/momentum/scheduler/momentum-flow-service'

type MomentumFlowPanelProps = {
  projectId?: string | null
  projectTitle?: string | null
  compact?: boolean
}

function flowError(payload: unknown, fallback: string) {
  const message = getResponseErrorMessage(payload, fallback)
  const lower = message.toLowerCase()
  if (lower.includes('momentum_flow') || lower.includes('schema cache') || lower.includes('relation')) {
    return 'Momentum Flow database is not ready. Apply supabase/patches/add_momentum_flow.sql, reload the schema, then refresh.'
  }
  return message
}

function selectedSessionIds(proposal: MomentumFlowProposal | null) {
  if (!proposal) return new Set<string>()
  return new Set(proposal.sessions.filter((session) => session.status === 'proposed').map((session) => session.id))
}

function moveByMinutes(session: MomentumFlowSession, minutes: number) {
  const start = new Date(session.start_at)
  const end = new Date(session.end_at)
  start.setMinutes(start.getMinutes() + minutes)
  end.setMinutes(end.getMinutes() + minutes)
  return {
    start_at: start.toISOString(),
    end_at: end.toISOString(),
  }
}

function appliedInsights(sessions: MomentumFlowSession[], unscheduledMinutes: number) {
  const workSessions = sessions.filter((session) => session.session_type !== 'break')
  const totalFocus = workSessions.reduce((total, session) => total + session.duration_minutes, 0)
  const deepWork = workSessions.filter((session) => session.session_type === 'deep_work').reduce((total, session) => total + session.duration_minutes, 0)
  const contextSwitches = sessions.reduce((total, session, index) => {
    const previous = sessions[index - 1]
    if (!previous || previous.project_id === session.project_id) return total
    return total + 1
  }, 0)

  return {
    total_focus_minutes: totalFocus,
    deep_work_percentage: totalFocus === 0 ? 0 : Math.round((deepWork / totalFocus) * 100),
    context_switches: contextSwitches,
    break_minutes: sessions.reduce((total, session) => (session.session_type === 'break' ? total + session.duration_minutes : total), 0),
    risk_weighted_minutes: workSessions.reduce((total, session) => total + Math.round((session.duration_minutes * session.score) / 100), 0),
    unscheduled_minutes: unscheduledMinutes,
  }
}

export function MomentumFlowPanel({ projectId = null, projectTitle = null, compact = false }: MomentumFlowPanelProps) {
  const [today, setToday] = useState<MomentumFlowToday | null>(null)
  const [proposal, setProposal] = useState<MomentumFlowProposal | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [explanation, setExplanation] = useState<MomentumFlowExplanation | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [explaining, setExplaining] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const todayUrl = useMemo(() => {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
    return `/api/momentum-flow/today${query}`
  }, [projectId])

  const appliedSessions = today?.applied_sessions ?? []
  const hasAppliedSessions = appliedSessions.length > 0
  const title = projectId ? 'Project Momentum Flow' : "Today's Momentum Flow"
  const description = projectId
    ? `Build a reviewable focus plan for ${projectTitle ?? 'this project'} without changing task dates.`
    : 'Turn priority, risk, recovery, simulation pressure, and capacity into reviewable focus sessions.'

  const loadToday = useCallback(async () => {
    setLoading(true)
    setError(null)
    const response = await fetch(todayUrl, { cache: 'no-store' })
    const payload = await readResponsePayload<MomentumFlowToday | { error: string }>(response)

    if (!response.ok) {
      setToday(null)
      setProposal(null)
      setSelectedIds(new Set())
      setError(flowError(payload, 'Could not load Momentum Flow.'))
      setLoading(false)
      return
    }

    const nextToday = payload as MomentumFlowToday
    setToday(nextToday)
    setProposal(nextToday.active_proposal)
    setSelectedIds(selectedSessionIds(nextToday.active_proposal))
    setExplanation(null)
    setLoading(false)
  }, [todayUrl])

  useEffect(() => {
    void loadToday()
  }, [loadToday])

  function toggleSession(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function generateProposal() {
    setGenerating(true)
    setError(null)
    setExplanation(null)

    const response = await fetch('/api/momentum-flow/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        horizon_days: 1,
      }),
    })
    const payload = await readResponsePayload<MomentumFlowProposal | { error: string }>(response)

    if (!response.ok) {
      setError(flowError(payload, 'Could not generate Momentum Flow.'))
      setGenerating(false)
      return
    }

    const nextProposal = payload as MomentumFlowProposal
    setProposal(nextProposal)
    setSelectedIds(selectedSessionIds(nextProposal))
    notify.success('Momentum Flow proposal ready')
    setGenerating(false)
  }

  async function applySelectedSessions() {
    if (!proposal) return

    setApplying(true)
    setError(null)
    const response = await fetch(`/api/momentum-flow/proposals/${proposal.id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_ids: Array.from(selectedIds) }),
    })
    const payload = await readResponsePayload<MomentumFlowProposal | { error: string }>(response)

    if (!response.ok) {
      setError(flowError(payload, 'Could not apply Momentum Flow.'))
      setApplying(false)
      return
    }

    setProposal(null)
    setSelectedIds(new Set())
    notify.success('Momentum Flow applied')
    await loadToday()
    setApplying(false)
  }

  async function explainProposal() {
    if (!proposal) return

    setExplaining(true)
    setError(null)
    const response = await fetch(`/api/momentum-flow/proposals/${proposal.id}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const payload = await readResponsePayload<MomentumFlowExplanation | { error: string }>(response)

    if (!response.ok) {
      setError(flowError(payload, 'Could not explain Momentum Flow.'))
      setExplaining(false)
      return
    }

    setExplanation(payload as MomentumFlowExplanation)
    setExplaining(false)
  }

  async function updateSession(session: MomentumFlowSession, body: Record<string, unknown>) {
    setUpdatingId(session.id)
    setError(null)
    const response = await fetch(`/api/momentum-flow/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await readResponsePayload<MomentumFlowSession | { error: string }>(response)

    if (!response.ok) {
      setError(flowError(payload, 'Could not update focus session.'))
      setUpdatingId(null)
      return
    }

    await loadToday()
    setUpdatingId(null)
  }

  function patchStatus(session: MomentumFlowSession, status: MomentumFlowSessionStatus) {
    const nextBody: Record<string, unknown> = { status }
    if (status === 'locked') nextBody.is_locked = true
    void updateSession(session, nextBody)
  }

  return (
    <section
      id="momentum-flow"
      className={`rounded-[28px] border border-[#e7dece] bg-white/75 shadow-[0_16px_40px_rgba(83,67,48,0.07)] ${
        compact ? 'p-5' : 'p-6'
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef5f0] text-[#2f6b4f]">
            <CalendarClock className="h-5 w-5" />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Momentum Flow</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#2d241c]">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b5f52]">{description}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <button
            type="button"
            onClick={generateProposal}
            disabled={generating}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2f6b4f] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#27583f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {hasAppliedSessions ? 'Regenerate Flow' : 'Generate Today'}
          </button>
          {hasAppliedSessions && <p className="text-xs leading-5 text-[#8a7f72]">Locked and manual sessions are preserved when regenerating.</p>}
        </div>
      </div>

      {error && <div className="mt-5 rounded-2xl border border-[#f1c7b5] bg-[#fff0ea] p-4 text-sm font-semibold text-[#8a3a2d]">{error}</div>}

      {loading ? (
        <div className="mt-6 flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-[#d8c5aa] bg-[#fbf7f0]">
          <Loader2 className="h-5 w-5 animate-spin text-[#9a5b2b]" />
        </div>
      ) : proposal ? (
        <div className="mt-6 space-y-4">
          <ScheduleProposalReview
            proposal={proposal}
            selectedIds={selectedIds}
            onToggle={toggleSession}
            onApply={applySelectedSessions}
            applying={applying}
          />
          <MomentumFlowWhyPanel explanation={explanation} loading={explaining} onExplain={explainProposal} />
        </div>
      ) : today ? (
        <div className="mt-6 space-y-4">
          <CapacitySummary capacity={today.capacity_summary} />
          {hasAppliedSessions ? (
            <>
              <ScheduleInsights insights={appliedInsights(appliedSessions, today.backlog_remaining.total_minutes)} />
              <div className="rounded-2xl border border-[#eadfce] bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Applied Sessions</p>
                    <p className="mt-1 text-sm text-[#6b5f52]">Manual changes stay separate from task due dates.</p>
                  </div>
                  {updatingId && <RefreshCw className="h-4 w-4 animate-spin text-[#9a5b2b]" />}
                </div>
                <MomentumFlowTimeline
                  sessions={appliedSessions}
                  onLock={(session) => patchStatus(session, 'locked')}
                  onMove={(session) =>
                    void updateSession(session, {
                      ...moveByMinutes(session, 30),
                      status: 'locked',
                      is_locked: true,
                    })
                  }
                  onComplete={(session) => patchStatus(session, 'completed')}
                  onSkip={(session) => patchStatus(session, 'skipped')}
                />
              </div>
              <BacklogRemainingList backlog={today.backlog_remaining} />
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d8c5aa] bg-[#fbf7f0] p-5 text-sm leading-6 text-[#6b5f52]">
              No Momentum Flow is scheduled yet. Generate a proposal to review focus sessions before anything is applied.
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
