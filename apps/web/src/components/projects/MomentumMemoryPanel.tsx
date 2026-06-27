'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Filter,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'

import { AskMomentumPanel } from '@/components/projects/AskMomentumPanel'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { notify } from '@/lib/notify'
import type {
  DecisionCategory,
  ProjectDecisionRecord,
  ProjectTimelineItem,
  RecordProjectDecisionInput,
  TimelineFilter,
} from '@/types/project-intelligence'

type MomentumMemoryPanelProps = {
  projectId: string
  canWrite: boolean
  refreshKey: number
}

const FILTERS: Array<{ id: TimelineFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'ai', label: 'AI' },
  { id: 'decisions', label: 'Decisions' },
]

const DECISION_CATEGORIES: Array<{ id: DecisionCategory; label: string }> = [
  { id: 'architecture', label: 'Architecture' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'product', label: 'Product' },
  { id: 'technical', label: 'Technical' },
  { id: 'risk', label: 'Risk' },
  { id: 'scope', label: 'Scope' },
  { id: 'deployment', label: 'Deployment' },
  { id: 'budget', label: 'Budget' },
]

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function formatDateGroup(value: string) {
  const date = new Date(value)
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const today = new Date()
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const diffDays = Math.round((todayKey - target) / 86_400_000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

function importanceClass(value: ProjectTimelineItem['importance']) {
  if (value === 'critical') return 'bg-[#fff0ea] text-[#a33a2b] border-[#f1c7b5]'
  if (value === 'high') return 'bg-[#fff6dc] text-[#8a5b00] border-[#ecd9a0]'
  if (value === 'normal') return 'bg-[#eef5f0] text-[#2f6b4f] border-[#cfe0d5]'
  return 'bg-[#f3ede2] text-[#6b5f52] border-[#e4d9c9]'
}

function filterMatch(item: ProjectTimelineItem, filter: TimelineFilter) {
  return filter === 'all' ? true : item.filter === filter
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function EventCard({
  item,
  onOpenDecision,
}: {
  item: ProjectTimelineItem
  onOpenDecision?: (decisionId: string) => void
}) {
  const decisionId = item.event_type === 'decision.accepted' ? item.id : null

  return (
    <article className="rounded-2xl border border-[#eadfce] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">{formatTime(item.occurred_at)}</p>
          <p className="mt-2 text-base font-semibold text-[#2d241c]">{item.summary}</p>
          <p className="mt-1 text-sm text-[#8a7f72]">{item.actor.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${importanceClass(item.importance)}`}>
            {item.importance}
          </span>
          {decisionId && onOpenDecision ? (
            <button
              type="button"
              onClick={() => onOpenDecision(decisionId)}
              className="inline-flex items-center gap-1 rounded-full bg-[#fbf7f0] px-3 py-1.5 text-xs font-bold text-[#6b4a30] hover:bg-[#f3ede2]"
            >
              Evidence
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      {item.reason ? <p className="mt-3 text-sm leading-6 text-[#6b5f52]">{item.reason}</p> : null}
      {item.facts.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.facts.map((fact) => (
            <span key={`${item.id}-${fact.label}`} className="rounded-full bg-[#fbf7f0] px-3 py-1.5 text-xs font-semibold text-[#6b5f52]">
              {fact.label}: {fact.value}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function RecordDecisionModal({
  open,
  onClose,
  onSubmit,
  events,
  saving,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (payload: RecordProjectDecisionInput) => Promise<void>
  events: ProjectTimelineItem[]
  saving: boolean
}) {
  const [title, setTitle] = useState('')
  const [decision, setDecision] = useState('')
  const [reason, setReason] = useState('')
  const [category, setCategory] = useState<DecisionCategory>('product')
  const [importance, setImportance] = useState<ProjectTimelineItem['importance']>('normal')
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([])

  useEffect(() => {
    if (!open) {
      setTitle('')
      setDecision('')
      setReason('')
      setCategory('product')
      setImportance('normal')
      setSelectedEvidence([])
    }
  }, [open])

  if (!open) return null

  const recentEvidence = events.filter((event) => event.event_type !== 'decision.accepted').slice(0, 12)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit({
      title,
      decision,
      reason,
      category,
      importance,
      evidence_event_ids: selectedEvidence,
    })
  }

  function toggleEvidence(id: string) {
    setSelectedEvidence((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#201a13]/45 px-4 py-8">
      <div className="w-full max-w-3xl rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-[0_24px_80px_rgba(32,26,19,0.2)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Momentum Memory</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#2d241c]">Record Decision</h3>
            <p className="mt-2 text-sm leading-6 text-[#6b5f52]">Add an accepted project decision to the immutable timeline.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-[#fbf7f0] p-2 text-[#6b5f52] hover:bg-[#f3ede2]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-[#2d241c]">Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#d8c5aa] bg-[#fbf7f0] px-4 py-3 text-sm text-[#2d241c] outline-none ring-0 focus:border-[#9a5b2b]"
                placeholder="Launch date"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#2d241c]">Category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as DecisionCategory)}
                className="mt-2 w-full rounded-2xl border border-[#d8c5aa] bg-[#fbf7f0] px-4 py-3 text-sm text-[#2d241c] outline-none focus:border-[#9a5b2b]"
              >
                {DECISION_CATEGORIES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-[#2d241c]">Decision</span>
            <textarea
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-2xl border border-[#d8c5aa] bg-[#fbf7f0] px-4 py-3 text-sm text-[#2d241c] outline-none focus:border-[#9a5b2b]"
              placeholder="Delay launch by one week."
              required
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-[#2d241c]">Reason</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-[#d8c5aa] bg-[#fbf7f0] px-4 py-3 text-sm text-[#2d241c] outline-none focus:border-[#9a5b2b]"
                placeholder="Authentication is not stable."
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#2d241c]">Importance</span>
              <select
                value={importance}
                onChange={(event) => setImportance(event.target.value as ProjectTimelineItem['importance'])}
                className="mt-2 w-full rounded-2xl border border-[#d8c5aa] bg-[#fbf7f0] px-4 py-3 text-sm text-[#2d241c] outline-none focus:border-[#9a5b2b]"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-[#eadfce] bg-[#fbf7f0] p-4">
            <p className="text-sm font-semibold text-[#2d241c]">Supporting Evidence</p>
            <p className="mt-1 text-sm text-[#6b5f52]">Optional. Link recent project events so the decision has a factual evidence trail.</p>
            <div className="mt-4 space-y-2">
              {recentEvidence.length === 0 ? (
                <p className="text-sm text-[#8a7f72]">No recent timeline events are available to link yet.</p>
              ) : (
                recentEvidence.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#eadfce] bg-white p-3">
                    <input
                      type="checkbox"
                      checked={selectedEvidence.includes(item.id)}
                      onChange={() => toggleEvidence(item.id)}
                      className="mt-1 h-4 w-4 rounded border-[#c6b39a] text-[#9a5b2b]"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#2d241c]">{item.summary}</p>
                      <p className="mt-1 text-xs text-[#8a7f72]">
                        {formatDateGroup(item.occurred_at)} at {formatTime(item.occurred_at)} by {item.actor.label}
                      </p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-2xl border border-[#d8c5aa] px-5 py-3 text-sm font-bold text-[#6b4a30]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#9a5b2b] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Record decision
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EvidenceDrawer({
  decision,
  onClose,
}: {
  decision: ProjectDecisionRecord | null
  onClose: () => void
}) {
  if (!decision) return null

  return (
    <div className="fixed inset-0 z-50 bg-[#201a13]/40">
      <button type="button" aria-label="Close evidence drawer" className="absolute inset-0" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-[#eadfce] bg-white p-6 shadow-[0_24px_80px_rgba(32,26,19,0.2)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Evidence Drawer</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#2d241c]">{decision.title}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${importanceClass(decision.importance)}`}>
                {decision.importance}
              </span>
              <span className="rounded-full bg-[#eef5f0] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2f6b4f]">
                Accepted
              </span>
              <span className="rounded-full bg-[#fbf7f0] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b5f52]">
                {decision.category}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-[#fbf7f0] p-2 text-[#6b5f52] hover:bg-[#f3ede2]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-[#eadfce] bg-[#fbf7f0] p-4">
          <p className="text-sm font-semibold text-[#2d241c]">Decision</p>
          <p className="mt-2 text-sm leading-6 text-[#6b5f52]">{decision.decision}</p>
          {decision.reason ? (
            <>
              <p className="mt-4 text-sm font-semibold text-[#2d241c]">Reason</p>
              <p className="mt-2 text-sm leading-6 text-[#6b5f52]">{decision.reason}</p>
            </>
          ) : null}
          <p className="mt-4 text-xs text-[#8a7f72]">
            Recorded {formatDateGroup(decision.occurred_at)} at {formatTime(decision.occurred_at)} by {decision.actor.label}
          </p>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#2f6b4f]" />
            <h4 className="text-lg font-semibold text-[#2d241c]">Evidence</h4>
          </div>
          {decision.evidence.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#d8c5aa] bg-[#fbf7f0] p-4 text-sm text-[#6b5f52]">
              No evidence events were linked when this decision was recorded.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {decision.evidence.map((item) => (
                <EventCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

export function MomentumMemoryPanel({ projectId, canWrite, refreshKey }: MomentumMemoryPanelProps) {
  const [timeline, setTimeline] = useState<ProjectTimelineItem[]>([])
  const [decisions, setDecisions] = useState<ProjectDecisionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<TimelineFilter>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerDecisionId, setDrawerDecisionId] = useState<string | null>(null)

  const loadMemory = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [timelineResponse, decisionsResponse] = await Promise.all([
      fetch(`/api/projects/${projectId}/intelligence/timeline`, { cache: 'no-store' }),
      fetch(`/api/projects/${projectId}/decisions`, { cache: 'no-store' }),
    ])

    const [timelinePayload, decisionsPayload] = await Promise.all([
      readResponsePayload<ProjectTimelineItem[] | { error: string }>(timelineResponse),
      readResponsePayload<ProjectDecisionRecord[] | { error: string }>(decisionsResponse),
    ])

    if (!timelineResponse.ok) {
      setError(getResponseErrorMessage(timelinePayload, 'Could not load project timeline.'))
      setTimeline([])
      setDecisions([])
      setLoading(false)
      return
    }

    if (!decisionsResponse.ok) {
      setError(getResponseErrorMessage(decisionsPayload, 'Could not load project decisions.'))
      setTimeline(Array.isArray(timelinePayload) ? timelinePayload : [])
      setDecisions([])
      setLoading(false)
      return
    }

    setTimeline(Array.isArray(timelinePayload) ? timelinePayload : [])
    setDecisions(Array.isArray(decisionsPayload) ? decisionsPayload : [])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    void loadMemory()
  }, [loadMemory, refreshKey])

  const filteredTimeline = useMemo(() => timeline.filter((item) => filterMatch(item, filter)), [filter, timeline])
  const lastActivityLabel = timeline[0] ? formatDateGroup(timeline[0].occurred_at) : 'None yet'

  const timelineGroups = useMemo(() => {
    const groups = new Map<string, ProjectTimelineItem[]>()
    for (const item of filteredTimeline) {
      const key = formatDateGroup(item.occurred_at)
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
    return Array.from(groups.entries())
  }, [filteredTimeline])

  const drawerDecision = useMemo(
    () => decisions.find((item: ProjectDecisionRecord) => item.id === drawerDecisionId) ?? null,
    [decisions, drawerDecisionId]
  )

  async function handleRecordDecision(payload: RecordProjectDecisionInput) {
    setSaving(true)
    const response = await fetch(`/api/projects/${projectId}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await readResponsePayload<ProjectDecisionRecord | { error: string }>(response)

    if (!response.ok) {
      notify.error(getResponseErrorMessage(body, 'Could not record decision.'))
      setSaving(false)
      return
    }

    notify.success('Decision recorded in Momentum Memory')
    setModalOpen(false)
    setSaving(false)
    await loadMemory()
    setDrawerDecisionId((body as ProjectDecisionRecord).id)
  }

  return (
    <>
      <section className="rounded-[28px] border border-[#e7dece] bg-white/80 p-6 shadow-[0_16px_40px_rgba(83,67,48,0.07)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef5f0] text-[#2f6b4f]">
              <BookOpenText className="h-5 w-5" />
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Momentum Memory</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#2d241c]">What happened in this project?</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b5f52]">
              Review a factual project timeline, record accepted decisions, and open the evidence behind them without leaving the project.
            </p>
          </div>
          {canWrite ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2f6b4f] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#27583f]"
            >
              <Plus className="h-4 w-4" />
              Record decision
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-[#f1c7b5] bg-[#fff0ea] p-4 text-sm font-semibold text-[#8a3a2d]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-[#d8c5aa] bg-[#fbf7f0]">
            <Loader2 className="h-5 w-5 animate-spin text-[#9a5b2b]" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#fbf7f0] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7f72]">Events</p>
                <p className="mt-1 text-2xl font-semibold text-[#2d241c]">{timeline.length}</p>
              </div>
              <div className="rounded-2xl bg-[#fbf7f0] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7f72]">Decisions</p>
                <p className="mt-1 text-2xl font-semibold text-[#2d241c]">{decisions.length}</p>
              </div>
              <div className="rounded-2xl bg-[#fbf7f0] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7f72]">Last Activity</p>
                <p className="mt-1 text-2xl font-semibold text-[#2d241c]">{lastActivityLabel}</p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.25fr_0.85fr]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#fbf7f0] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#8a7f72]">
                  <Filter className="h-3.5 w-3.5" />
                  Timeline filters
                </div>
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition ${
                      filter === item.id ? 'bg-[#2d241c] text-white' : 'bg-[#fbf7f0] text-[#6b5f52] hover:bg-[#f3ede2]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="rounded-[24px] border border-[#eadfce] bg-[#fcfaf6] p-5">
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-[#9a5b2b]" />
                  <h3 className="text-lg font-semibold text-[#2d241c]">Timeline</h3>
                </div>
                {timelineGroups.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-[#d8c5aa] bg-white p-4 text-sm text-[#6b5f52]">
                    No timeline events match this filter yet.
                  </div>
                ) : (
                  <div className="mt-5 space-y-6">
                    {timelineGroups.map(([label, items]) => (
                      <section key={label}>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">{label}</p>
                        <div className="mt-3 space-y-3">
                          {items.map((item) => (
                            <EventCard key={item.id} item={item} onOpenDecision={setDrawerDecisionId} />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[24px] border border-[#eadfce] bg-white p-5">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-[#2f6b4f]" />
                  <h3 className="text-lg font-semibold text-[#2d241c]">Decisions</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#6b5f52]">Accepted project decisions stay here with their supporting evidence.</p>
                {decisions.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-[#d8c5aa] bg-[#fbf7f0] p-4 text-sm text-[#6b5f52]">
                    No decisions have been recorded yet.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {decisions.map((decision) => (
                      <button
                        key={decision.id}
                        type="button"
                        onClick={() => setDrawerDecisionId(decision.id)}
                        className="w-full rounded-2xl border border-[#eadfce] bg-[#fbf7f0] p-4 text-left transition hover:border-[#cbb79e] hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">{decision.category}</p>
                            <p className="mt-2 text-base font-semibold text-[#2d241c]">{decision.title}</p>
                            <p className="mt-2 text-sm text-[#6b5f52] line-clamp-2">{decision.decision}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#8a7f72]">
                              <span className="rounded-full bg-white px-2.5 py-1 font-bold uppercase tracking-[0.12em] text-[#2f6b4f]">
                                Accepted
                              </span>
                              <span className={`rounded-full border px-2.5 py-1 font-bold uppercase tracking-[0.12em] ${importanceClass(decision.importance)}`}>
                                {decision.importance}
                              </span>
                              <span className="rounded-full bg-white px-2.5 py-1 font-semibold">
                                {pluralize(decision.evidence.length, 'Evidence Item')}
                              </span>
                              <span className="rounded-full bg-white px-2.5 py-1 font-semibold">{formatDateGroup(decision.occurred_at)}</span>
                            </div>
                          </div>
                          <ArrowRight className="mt-1 h-4 w-4 flex-none text-[#9a5b2b]" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <AskMomentumPanel projectId={projectId} />

              <div className="rounded-[24px] border border-[#d8e8de] bg-[#f7fbf8] p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#2f6b4f]" />
                  <h3 className="text-lg font-semibold text-[#2d241c]">Demo Value</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#4c6557]">
                  This turns project history into something you can actually explain during a demo: what changed, who decided it, and which facts supported it.
                </p>
              </div>
            </div>
          </div>
          </div>
        )}
      </section>

      <RecordDecisionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleRecordDecision}
        events={timeline}
        saving={saving}
      />
      <EvidenceDrawer decision={drawerDecision} onClose={() => setDrawerDecisionId(null)} />
    </>
  )
}
