'use client'

import { useMemo, useState } from 'react'
import { CheckSquare, Loader2, Milestone, Sparkles, Wand2 } from 'lucide-react'

import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { notify } from '@/lib/notify'
import type {
  WorkBreakdownMilestoneProposal,
  WorkBreakdownResult,
  WorkBreakdownTaskProposal,
} from '@/lib/momentum/ai/capabilities/work-breakdown'
import type { TaskItem, TaskPriority } from '@/types/task'

type WorkBreakdownPanelProps = {
  projectId: string
  projectTitle: string
  canWrite: boolean
  onTasksCreated: () => Promise<void> | void
}

const SAMPLE_GOAL = 'Prepare the Momentum AI hackathon demo with a polished end-to-end execution workflow.'

function taskKey(milestoneIndex: number, taskIndex: number) {
  return `${milestoneIndex}:${taskIndex}`
}

function confidenceTone(confidence: number) {
  if (confidence >= 0.85) return 'bg-[#2f6b4f]'
  if (confidence >= 0.7) return 'bg-[#9a5b2b]'
  return 'bg-[#b7791f]'
}

function priorityClass(priority: TaskPriority) {
  if (priority === 'urgent') return 'bg-[#fff0ea] text-[#a33a2b]'
  if (priority === 'high') return 'bg-[#fff6dc] text-[#8a5b00]'
  if (priority === 'low') return 'bg-[#eef5f0] text-[#2f6b4f]'
  return 'bg-[#f3ede2] text-[#6b5f52]'
}

function dueDateToIso(value: string | null) {
  if (!value) return null
  const date = new Date(`${value}T17:00:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function taskDescription(milestone: WorkBreakdownMilestoneProposal, task: WorkBreakdownTaskProposal) {
  const details = [task.description, milestone.objective ? `Milestone: ${milestone.title}. ${milestone.objective}` : `Milestone: ${milestone.title}.`]
    .filter(Boolean)
    .join('\n\n')

  return details || null
}

export function WorkBreakdownPanel({ projectId, projectTitle, canWrite, onTasksCreated }: WorkBreakdownPanelProps) {
  const [goal, setGoal] = useState('')
  const [result, setResult] = useState<WorkBreakdownResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [creating, setCreating] = useState(false)

  const selectedTasks = useMemo(() => {
    if (!result) return []
    return result.milestones.flatMap((milestone, milestoneIndex) =>
      milestone.tasks
        .map((task, taskIndex) => ({ milestone, task, key: taskKey(milestoneIndex, taskIndex) }))
        .filter((item) => selected.has(item.key))
    )
  }, [result, selected])

  if (!canWrite) return null

  async function generatePlan() {
    if (!goal.trim()) return

    setGenerating(true)
    setResult(null)
    setSelected(new Set())

    const response = await fetch('/api/ai/work-breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, project_id: projectId }),
    })
    const payload = await readResponsePayload<WorkBreakdownResult | { error: string }>(response)

    if (!response.ok) {
      notify.error(getResponseErrorMessage(payload, 'Could not generate work breakdown'))
      setGenerating(false)
      return
    }

    const nextResult = payload as WorkBreakdownResult
    setResult(nextResult)
    setSelected(
      new Set(
        nextResult.milestones.flatMap((milestone, milestoneIndex) =>
          milestone.tasks.map((_, taskIndex) => taskKey(milestoneIndex, taskIndex))
        )
      )
    )
    notify.success(nextResult.milestones.length > 0 ? 'Execution plan ready' : 'No plan generated')
    setGenerating(false)
  }

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function createSelectedTasks() {
    if (selectedTasks.length === 0) return
    setCreating(true)

    for (const item of selectedTasks) {
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.task.title,
          description: taskDescription(item.milestone, item.task),
          priority: item.task.priority,
          status: 'todo',
          due_at: dueDateToIso(item.task.due_date),
          estimate_minutes: item.task.estimate_minutes,
        }),
      })
      const payload = await readResponsePayload<TaskItem | { error: string }>(response)
      if (!response.ok) {
        notify.error(getResponseErrorMessage(payload, `Could not create ${item.task.title}`))
        setCreating(false)
        return
      }
    }

    notify.success(`${selectedTasks.length} task${selectedTasks.length === 1 ? '' : 's'} created from plan`)
    setCreating(false)
    setResult(null)
    setSelected(new Set())
    setGoal('')
    await onTasksCreated()
  }

  return (
    <section className="rounded-[28px] border border-[#e7dece] bg-white/75 p-5 shadow-[0_16px_40px_rgba(83,67,48,0.07)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">
            <Sparkles className="h-4 w-4 text-[#9a5b2b]" />
            Plan work
          </p>
          <h2 className="mt-2 text-2xl font-light tracking-tight text-[#1f2937]" style={{ fontFamily: 'Newsreader, Georgia, serif' }}>
            Break down a goal with Momentum
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b5f52]">
            Enter a high-level goal. Momentum proposes milestones and task cards for review before anything is created in {projectTitle}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setGoal(SAMPLE_GOAL)}
          className="inline-flex items-center justify-center rounded-2xl border border-[#e7dece] bg-white px-4 py-2 text-xs font-bold text-[#6b5f52] transition hover:border-[#d8c5aa]"
        >
          Use sample
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-[#7b746b]">Goal</span>
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              className="mt-2 min-h-44 w-full rounded-2xl border border-[#e7dece] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#9a5b2b]"
              placeholder="Describe the outcome you want to achieve..."
            />
          </label>
          <button
            type="button"
            onClick={() => void generatePlan()}
            disabled={generating || !goal.trim()}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#9a5b2b] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#854d24] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Generate Plan
          </button>
        </div>

        <div className="rounded-2xl border border-[#eadfce] bg-[#fbf7f0] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Proposal Review</p>
              <p className="mt-1 text-sm text-[#6b5f52]">
                {result
                  ? `${result.milestones.length} milestone${result.milestones.length === 1 ? '' : 's'} ready`
                  : 'No plan yet'}
              </p>
            </div>
            {result?.ai_run_id && <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#7b746b]">Momentum</span>}
            {result?.mode === 'fallback' && <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#7b746b]">Fallback</span>}
          </div>

          {!result ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#d7c6ad] bg-white/70 p-5 text-sm leading-6 text-[#6b5f52]">
              Generated milestones and tasks will appear here. Select the tasks you want before applying the plan.
            </div>
          ) : result.milestones.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#d7c6ad] bg-white/70 p-5 text-sm leading-6 text-[#6b5f52]">
              Momentum could not create a concrete plan from that goal.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {result.milestones.map((milestone, milestoneIndex) => (
                <div key={`${milestone.title}-${milestoneIndex}`} className="rounded-2xl border border-[#e7dece] bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 rounded-xl bg-[#f3ede2] p-2 text-[#9a5b2b]">
                      <Milestone className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[#1f2937]">{milestone.title}</h3>
                      {milestone.objective && <p className="mt-1 text-sm leading-5 text-[#6b5f52]">{milestone.objective}</p>}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {milestone.tasks.map((task, taskIndex) => {
                      const key = taskKey(milestoneIndex, taskIndex)
                      return (
                        <button
                          type="button"
                          key={`${task.title}-${taskIndex}`}
                          onClick={() => toggle(key)}
                          className="w-full rounded-2xl border border-[#eadfce] bg-[#fbf7f0] p-4 text-left transition hover:border-[#d8c5aa]"
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-md border ${
                                selected.has(key) ? 'border-[#2f6b4f] bg-[#2f6b4f] text-white' : 'border-[#c9b99f] bg-white'
                              }`}
                            >
                              {selected.has(key) && <CheckSquare className="h-3.5 w-3.5" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-[#1f2937]">{task.title}</p>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${priorityClass(task.priority)}`}>
                                  {task.priority}
                                </span>
                                {task.estimate_minutes && (
                                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#6b5f52]">
                                    {task.estimate_minutes}m
                                  </span>
                                )}
                                {task.due_date && (
                                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#6b5f52]">
                                    {task.due_date}
                                  </span>
                                )}
                              </div>
                              {task.description && <p className="mt-2 text-sm leading-5 text-[#6b5f52]">{task.description}</p>}
                              <div className="mt-3">
                                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-[#8a7f72]">
                                  <span>Confidence</span>
                                  <span>{Math.round(task.confidence * 100)}%</span>
                                </div>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eadfce]">
                                  <div className={`h-full ${confidenceTone(task.confidence)}`} style={{ width: `${Math.round(task.confidence * 100)}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {result && result.milestones.length > 0 && (
            <button
              type="button"
              onClick={() => void createSelectedTasks()}
              disabled={creating || selectedTasks.length === 0}
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
