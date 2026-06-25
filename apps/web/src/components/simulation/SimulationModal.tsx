'use client'

import { useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'

import { SimulationResults } from '@/components/simulation/SimulationResults'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { notify } from '@/lib/notify'
import type { GoalSimulation } from '@/lib/momentum/simulation-service'
import type { TaskItem } from '@/types/task'

type SimulationModalProps = {
  open: boolean
  projectId: string
  projectTitle: string
  targetDeadline: string | null
  tasks: TaskItem[]
  onClose: () => void
}

function dateOnly(value: string | null) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

function openTaskLabel(task: TaskItem) {
  const due = task.due_at ? ` · due ${dateOnly(task.due_at)}` : ''
  return `${task.title}${due}`
}

export function SimulationModal({ open, projectId, projectTitle, targetDeadline, tasks, onClose }: SimulationModalProps) {
  const [deadline, setDeadline] = useState(dateOnly(targetDeadline))
  const [dailyHours, setDailyHours] = useState(4)
  const [extraHours, setExtraHours] = useState(0)
  const [delayTaskId, setDelayTaskId] = useState('')
  const [delayDays, setDelayDays] = useState(2)
  const [shiftDays, setShiftDays] = useState(0)
  const [removeCompleted, setRemoveCompleted] = useState(true)
  const [running, setRunning] = useState(false)
  const [simulation, setSimulation] = useState<GoalSimulation | null>(null)

  const openTasks = useMemo(() => tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled'), [tasks])

  if (!open) return null

  async function runSimulation() {
    setRunning(true)
    const response = await fetch('/api/ai/simulate-goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        target_deadline: deadline || null,
        daily_work_hours: dailyHours,
        extra_daily_hours: extraHours,
        delay_task_id: delayTaskId || null,
        delay_days: delayTaskId ? delayDays : 0,
        shift_milestone_days: shiftDays,
        remove_completed_tasks: removeCompleted,
      }),
    })
    const payload = await readResponsePayload<GoalSimulation | { error: string }>(response)

    if (!response.ok) {
      notify.error(getResponseErrorMessage(payload, 'Could not run simulation'))
      setRunning(false)
      return
    }

    setSimulation(payload as GoalSimulation)
    notify.success('Goal simulation ready')
    setRunning(false)
  }

  function reviewRecovery() {
    onClose()
    window.setTimeout(() => {
      document.getElementById('recovery-planner')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#1f2937]/45 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl rounded-[32px] border border-[#e7dece] bg-[#f7f2e9] shadow-[0_30px_90px_rgba(31,41,55,0.25)]">
        <header className="flex items-start justify-between gap-4 border-b border-[#e7dece] bg-white/80 p-5 sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Goal Simulation</p>
            <h2 className="mt-2 text-3xl font-light tracking-tight text-[#1f2937]" style={{ fontFamily: 'Newsreader, Georgia, serif' }}>
              Can {projectTitle} finish on time?
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b5f52]">
              Simulate deadline, capacity, and task slip scenarios before applying any recovery or task changes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#e7dece] bg-white p-2 text-[#6b5f52] transition hover:border-[#d8c5aa]"
            aria-label="Close simulation"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="h-fit rounded-[24px] border border-[#e7dece] bg-white/80 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Simulation Inputs</p>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-[#7b746b]">Target deadline</span>
                <input
                  type="date"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[#e7dece] bg-white px-3 py-2 text-sm outline-none focus:border-[#9a5b2b]"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold text-[#7b746b]">Daily hours</span>
                  <input
                    type="number"
                    min={0.5}
                    max={16}
                    step={0.5}
                    value={dailyHours}
                    onChange={(event) => setDailyHours(Number(event.target.value))}
                    className="mt-1 w-full rounded-2xl border border-[#e7dece] bg-white px-3 py-2 text-sm outline-none focus:border-[#9a5b2b]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-[#7b746b]">Extra hours</span>
                  <input
                    type="number"
                    min={0}
                    max={16}
                    step={0.5}
                    value={extraHours}
                    onChange={(event) => setExtraHours(Number(event.target.value))}
                    className="mt-1 w-full rounded-2xl border border-[#e7dece] bg-white px-3 py-2 text-sm outline-none focus:border-[#9a5b2b]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold text-[#7b746b]">Delay selected task</span>
                <select
                  value={delayTaskId}
                  onChange={(event) => setDelayTaskId(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[#e7dece] bg-white px-3 py-2 text-sm outline-none focus:border-[#9a5b2b]"
                >
                  <option value="">No task slip</option>
                  {openTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {openTaskLabel(task)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold text-[#7b746b]">Delay days</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={delayDays}
                    onChange={(event) => setDelayDays(Number(event.target.value))}
                    disabled={!delayTaskId}
                    className="mt-1 w-full rounded-2xl border border-[#e7dece] bg-white px-3 py-2 text-sm outline-none focus:border-[#9a5b2b] disabled:opacity-50"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-[#7b746b]">Shift dates</span>
                  <input
                    type="number"
                    min={-14}
                    max={30}
                    value={shiftDays}
                    onChange={(event) => setShiftDays(Number(event.target.value))}
                    className="mt-1 w-full rounded-2xl border border-[#e7dece] bg-white px-3 py-2 text-sm outline-none focus:border-[#9a5b2b]"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-[#e7dece] bg-[#fbf7f0] p-3 text-sm font-semibold text-[#5f554b]">
                <input
                  type="checkbox"
                  checked={removeCompleted}
                  onChange={(event) => setRemoveCompleted(event.target.checked)}
                  className="h-4 w-4 accent-[#9a5b2b]"
                />
                Ignore completed work in projection
              </label>

              <button
                type="button"
                onClick={() => void runSimulation()}
                disabled={running}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#9a5b2b] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#854d24] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running && <Loader2 className="h-4 w-4 animate-spin" />}
                Run Simulation
              </button>
            </div>
          </aside>

          <main>
            {!simulation ? (
              <div className="flex min-h-[520px] items-center justify-center rounded-[24px] border border-dashed border-[#d7c6ad] bg-white/65 p-8 text-center">
                <div>
                  <p className="text-lg font-semibold text-[#1f2937]">No simulation yet</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#6b5f52]">
                    Run a scenario to compare current probability, projected finish date, health, risk, and recommended recovery moves.
                  </p>
                </div>
              </div>
            ) : (
              <SimulationResults simulation={simulation} onReviewRecovery={reviewRecovery} />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
