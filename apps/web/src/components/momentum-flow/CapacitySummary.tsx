'use client'

import type { CapacitySummary as CapacitySummaryType } from '@/lib/momentum/scheduler/momentum-flow-service'

function hours(value: number) {
  const rounded = Math.round((value / 60) * 10) / 10
  return `${rounded}h`
}

export function CapacitySummary({ capacity, confidence }: { capacity: CapacitySummaryType; confidence?: number }) {
  const productive = capacity.productive_minutes
  const scheduled = capacity.scheduled_minutes
  const remaining = Math.max(0, productive - scheduled)

  return (
    <section className="rounded-2xl border border-[#eadfce] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Capacity</p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl bg-[#fbf7f0] p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a7f72]">Today</p>
          <p className="mt-1 text-xl font-semibold text-[#2d241c]">{hours(productive)}</p>
        </div>
        <div className="rounded-2xl bg-[#fbf7f0] p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a7f72]">Scheduled</p>
          <p className="mt-1 text-xl font-semibold text-[#2d241c]">{hours(scheduled)}</p>
        </div>
        <div className="rounded-2xl bg-[#fbf7f0] p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a7f72]">Remaining</p>
          <p className="mt-1 text-xl font-semibold text-[#2d241c]">{hours(remaining)}</p>
        </div>
        <div className="rounded-2xl bg-[#fbf7f0] p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a7f72]">Confidence</p>
          <p className="mt-1 text-xl font-semibold text-[#2d241c]">{confidence ?? capacity.confidence}%</p>
        </div>
      </div>
    </section>
  )
}
