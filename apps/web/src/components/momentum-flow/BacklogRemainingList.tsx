'use client'

import type { BacklogRemaining } from '@/lib/momentum/scheduler/momentum-flow-service'

function minutes(value: number) {
  if (value < 60) return `${value}m`
  return `${Math.round((value / 60) * 10) / 10}h`
}

export function BacklogRemainingList({ backlog }: { backlog: BacklogRemaining }) {
  return (
    <section className="rounded-2xl border border-[#eadfce] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Backlog Remaining</p>
          <p className="mt-1 text-sm text-[#6b5f52]">
            {minutes(backlog.total_minutes)} across {backlog.task_count} task{backlog.task_count === 1 ? '' : 's'}
          </p>
        </div>
        {backlog.high_risk_task_count > 0 && (
          <span className="rounded-full bg-[#fff0ea] px-3 py-1 text-xs font-bold text-[#a33a2b]">
            {backlog.high_risk_task_count} risky
          </span>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {backlog.items.length === 0 ? (
          <div className="rounded-2xl bg-[#fbf7f0] p-3 text-sm text-[#6b5f52]">No unscheduled work remains in this proposal.</div>
        ) : (
          backlog.items.map((item) => (
            <div key={item.task_id} className="rounded-2xl bg-[#fbf7f0] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#2d241c]">{item.title}</p>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#6b5f52]">{minutes(item.remaining_minutes)}</span>
              </div>
              <p className="mt-1 text-xs text-[#8a7f72]">{item.project_title}</p>
              <p className="mt-2 text-xs leading-5 text-[#6b5f52]">{item.reason}</p>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
