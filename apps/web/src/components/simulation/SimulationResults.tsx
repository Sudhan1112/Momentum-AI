'use client'

import { AlertTriangle, ArrowRight, CheckCircle2, Clock, HeartPulse, TrendingUp } from 'lucide-react'

import type { GoalSimulation } from '@/lib/momentum/simulation-service'

function probabilityClass(value: number) {
  if (value >= 75) return 'text-[#2f6b4f]'
  if (value >= 50) return 'text-[#9a5b2b]'
  return 'text-[#a33a2b]'
}

function healthDot(level: string) {
  if (level === 'healthy') return 'bg-[#2f6b4f]'
  if (level === 'attention') return 'bg-[#b7791f]'
  return 'bg-[#a33a2b]'
}

function signed(value: number) {
  if (value > 0) return `+${value}`
  return `${value}`
}

function minutesLabel(value: number) {
  if (value < 60) return `${value}m`
  const hours = Math.round((value / 60) * 10) / 10
  return `${hours}h`
}

export function SimulationResults({ simulation, onReviewRecovery }: { simulation: GoalSimulation; onReviewRecovery: () => void }) {
  const currentHealth = simulation.current_state.workspace_health
  const projectedHealth = simulation.projected_state.workspace_health
  const finishLate = simulation.timeline_projection.schedule_delta_days > 0

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#e7dece] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Current Success Probability</p>
          <p className={`mt-3 text-4xl font-semibold ${probabilityClass(simulation.current_state.success_probability)}`}>
            {simulation.current_state.success_probability}%
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm text-[#6b5f52]">
            <span className={`h-2.5 w-2.5 rounded-full ${healthDot(currentHealth.level)}`} />
            {currentHealth.label}
          </div>
        </div>
        <div className="rounded-2xl border border-[#e7dece] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Projected Success Probability</p>
          <p className={`mt-3 text-4xl font-semibold ${probabilityClass(simulation.projected_state.success_probability)}`}>
            {simulation.projected_state.success_probability}%
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm text-[#6b5f52]">
            <span className={`h-2.5 w-2.5 rounded-full ${healthDot(projectedHealth.level)}`} />
            {projectedHealth.label}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[#fbf7f0] p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">
            <TrendingUp className="h-4 w-4 text-[#9a5b2b]" />
            Score Change
          </div>
          <p className="mt-2 text-2xl font-semibold text-[#1f2937]">{signed(simulation.execution_score_change)}</p>
        </div>
        <div className="rounded-2xl bg-[#fbf7f0] p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">
            <HeartPulse className="h-4 w-4 text-[#9a5b2b]" />
            Risk Change
          </div>
          <p className="mt-2 text-2xl font-semibold text-[#1f2937]">{signed(simulation.risk_change)}</p>
        </div>
        <div className="rounded-2xl bg-[#fbf7f0] p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">
            <Clock className="h-4 w-4 text-[#9a5b2b]" />
            Finish Date
          </div>
          <p className="mt-2 text-lg font-semibold text-[#1f2937]">{simulation.timeline_projection.estimated_finish_date}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e7dece] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Timeline Projection</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs font-bold text-[#8a7f72]">Target</p>
            <p className="mt-1 text-sm font-semibold text-[#1f2937]">{simulation.timeline_projection.target_deadline}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-[#8a7f72]">Remaining Work</p>
            <p className="mt-1 text-sm font-semibold text-[#1f2937]">{minutesLabel(simulation.timeline_projection.remaining_work_minutes)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-[#8a7f72]">Available</p>
            <p className="mt-1 text-sm font-semibold text-[#1f2937]">{minutesLabel(simulation.timeline_projection.available_minutes)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-[#8a7f72]">Schedule</p>
            <p className={`mt-1 text-sm font-semibold ${finishLate ? 'text-[#a33a2b]' : 'text-[#2f6b4f]'}`}>
              {finishLate ? `${simulation.timeline_projection.schedule_delta_days}d late` : 'On track'}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e7dece] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Momentum Explains</p>
        <p className="mt-3 text-sm leading-6 text-[#5f554b]">{simulation.ai_explanation}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {simulation.mode === 'fallback' && <span className="rounded-full bg-[#f3ede2] px-3 py-1 text-xs font-bold text-[#6b5f52]">Deterministic fallback</span>}
          {simulation.ai_run_id && <span className="rounded-full bg-[#eef5f0] px-3 py-1 text-xs font-bold text-[#2f6b4f]">AI run logged</span>}
        </div>
      </section>

      {simulation.critical_tasks.length > 0 && (
        <section className="rounded-2xl border border-[#e7dece] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Critical Tasks</p>
          <div className="mt-3 space-y-2">
            {simulation.critical_tasks.map((task) => (
              <div key={task.task_id} className="rounded-2xl bg-[#fbf7f0] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#1f2937]">{task.task_title}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#a33a2b]">{task.score_100}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#6b5f52]">{task.explanation}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-[#e7dece] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Recommended Actions</p>
        <div className="mt-3 space-y-2">
          {simulation.recommended_actions.map((action) => (
            <div key={`${action.type}-${action.label}`} className="flex gap-3 rounded-2xl bg-[#fbf7f0] p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-[#2f6b4f]" />
              <div>
                <p className="text-sm font-semibold text-[#1f2937]">{action.label}</p>
                <p className="mt-1 text-xs leading-5 text-[#6b5f52]">{action.reason}</p>
              </div>
            </div>
          ))}
          {simulation.recommended_actions.length === 0 && (
            <div className="rounded-2xl bg-[#fbf7f0] p-3 text-sm text-[#6b5f52]">No recovery action is needed for this scenario.</div>
          )}
        </div>

        {simulation.recovery_available && (
          <button
            type="button"
            onClick={onReviewRecovery}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2f6b4f] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#27583f]"
          >
            <AlertTriangle className="h-4 w-4" />
            Review Recovery
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </section>
    </div>
  )
}
