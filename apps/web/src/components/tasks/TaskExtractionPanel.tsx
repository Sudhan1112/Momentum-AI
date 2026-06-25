'use client'

import { useMemo, useState } from 'react'
import { CheckSquare, Loader2, Sparkles, Wand2 } from 'lucide-react'

import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { notify } from '@/lib/notify'
import type { ExtractTasksResult, TaskExtractionProposal } from '@/lib/momentum/ai/capabilities/extract-tasks'
import type { TaskItem, TaskPriority } from '@/types/task'

type TaskExtractionPanelProps = {
  projectId: string
  canWrite: boolean
  onTasksCreated: () => Promise<void> | void
}

const SAMPLE_TEXT = [
  'Need to prepare the Sprint 5C demo.',
  'Fix auth callback issue tomorrow.',
  'Deploy backend before mentor review.',
  'Create presentation outline.',
].join('\n')

function confidenceTone(confidence: number) {
  if (confidence >= 0.85) return 'bg-[#2f6b4f]'
  if (confidence >= 0.7) return 'bg-[#9a5b2b]'
  return 'bg-[#b7791f]'
}

function dueDateToIso(value: string | null) {
  if (!value) return null
  const date = new Date(`${value}T17:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function priorityClass(priority: TaskPriority) {
  if (priority === 'urgent') return 'bg-[#fff0ea] text-[#a33a2b]'
  if (priority === 'high') return 'bg-[#fff6dc] text-[#8a5b00]'
  if (priority === 'low') return 'bg-[#eef5f0] text-[#2f6b4f]'
  return 'bg-[#f3ede2] text-[#6b5f52]'
}

export function TaskExtractionPanel({ projectId, canWrite, onTasksCreated }: TaskExtractionPanelProps) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<ExtractTasksResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [extracting, setExtracting] = useState(false)
  const [creating, setCreating] = useState(false)

  const selectedProposals = useMemo(
    () => (result?.proposal ?? []).filter((_, index) => selected.has(index)),
    [result, selected]
  )

  if (!canWrite) return null

  async function extractTasks() {
    if (!text.trim()) return

    setExtracting(true)
    setResult(null)
    setSelected(new Set())

    const response = await fetch('/api/ai/extract-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, project_id: projectId }),
    })
    const payload = await readResponsePayload<ExtractTasksResult | { error: string }>(response)

    if (!response.ok) {
      notify.error(getResponseErrorMessage(payload, 'Could not extract tasks'))
      setExtracting(false)
      return
    }

    const nextResult = payload as ExtractTasksResult
    setResult(nextResult)
    setSelected(new Set(nextResult.proposal.map((_, index) => index)))
    notify.success(nextResult.proposal.length > 0 ? 'Task proposals ready' : 'No tasks found')
    setExtracting(false)
  }

  function toggle(index: number) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function createSelectedTasks() {
    if (selectedProposals.length === 0) return
    setCreating(true)

    for (const proposal of selectedProposals) {
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: proposal.title,
          description: proposal.description,
          priority: proposal.priority,
          status: 'todo',
          due_at: dueDateToIso(proposal.due_date),
        }),
      })
      const payload = await readResponsePayload<TaskItem | { error: string }>(response)
      if (!response.ok) {
        notify.error(getResponseErrorMessage(payload, `Could not create ${proposal.title}`))
        setCreating(false)
        return
      }
    }

    notify.success(`${selectedProposals.length} task${selectedProposals.length === 1 ? '' : 's'} created`)
    setCreating(false)
    setResult(null)
    setSelected(new Set())
    setText('')
    await onTasksCreated()
  }

  return (
    <section className="rounded-[28px] border border-[#e7dece] bg-white/75 p-5 shadow-[0_16px_40px_rgba(83,67,48,0.07)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">
            <Sparkles className="h-4 w-4 text-[#9a5b2b]" />
            Understand work
          </p>
          <h2 className="mt-2 text-2xl font-light tracking-tight text-[#1f2937]" style={{ fontFamily: 'Newsreader, Georgia, serif' }}>
            Extract tasks with Momentum
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b5f52]">
            Paste meeting notes or messy work. Momentum turns them into task proposals for review before anything is created.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setText(SAMPLE_TEXT)}
          className="inline-flex items-center justify-center rounded-2xl border border-[#e7dece] bg-white px-4 py-2 text-xs font-bold text-[#6b5f52] transition hover:border-[#d8c5aa]"
        >
          Use sample
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-[#7b746b]">Meeting notes</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="mt-2 min-h-56 w-full rounded-2xl border border-[#e7dece] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#9a5b2b]"
              placeholder="Paste notes, decisions, or action items..."
            />
          </label>
          <button
            type="button"
            onClick={() => void extractTasks()}
            disabled={extracting || !text.trim()}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#9a5b2b] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#854d24] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Extract Tasks
          </button>
        </div>

        <div className="rounded-2xl border border-[#eadfce] bg-[#fbf7f0] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Proposal Review</p>
              <p className="mt-1 text-sm text-[#6b5f52]">
                {result ? `${result.proposal.length} proposal${result.proposal.length === 1 ? '' : 's'} ready` : 'No proposal yet'}
              </p>
            </div>
            {result?.ai_run_id && <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#7b746b]">Momentum</span>}
            {result?.mode === 'fallback' && <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#7b746b]">Fallback</span>}
          </div>

          {!result ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#d7c6ad] bg-white/70 p-5 text-sm leading-6 text-[#6b5f52]">
              Extracted tasks will appear here with confidence scores before you create anything.
            </div>
          ) : result.proposal.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#d7c6ad] bg-white/70 p-5 text-sm leading-6 text-[#6b5f52]">
              Momentum did not find concrete tasks in that text.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {result.proposal.map((proposal: TaskExtractionProposal, index) => (
                <button
                  type="button"
                  key={`${proposal.title}-${index}`}
                  onClick={() => toggle(index)}
                  className="w-full rounded-2xl border border-[#e7dece] bg-white p-4 text-left transition hover:border-[#d8c5aa]"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-md border ${
                        selected.has(index) ? 'border-[#2f6b4f] bg-[#2f6b4f] text-white' : 'border-[#c9b99f] bg-white'
                      }`}
                    >
                      {selected.has(index) && <CheckSquare className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#1f2937]">{proposal.title}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${priorityClass(proposal.priority)}`}>
                          {proposal.priority}
                        </span>
                        {proposal.due_date && (
                          <span className="rounded-full bg-[#f3ede2] px-2.5 py-1 text-[11px] font-bold text-[#6b5f52]">
                            {proposal.due_date}
                          </span>
                        )}
                      </div>
                      {proposal.description && <p className="mt-2 text-sm leading-5 text-[#6b5f52]">{proposal.description}</p>}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-[#8a7f72]">
                          <span>Confidence</span>
                          <span>{Math.round(proposal.confidence * 100)}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eadfce]">
                          <div className={`h-full ${confidenceTone(proposal.confidence)}`} style={{ width: `${Math.round(proposal.confidence * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {result && result.proposal.length > 0 && (
            <button
              type="button"
              onClick={() => void createSelectedTasks()}
              disabled={creating || selectedProposals.length === 0}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2f6b4f] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#27583f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Selected Tasks
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
