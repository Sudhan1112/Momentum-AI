'use client'

import type { MomentumFlowInsights } from '@/lib/momentum/scheduler/momentum-flow-service'

function minutes(value: number) {
  if (value < 60) return `${value}m`
  return `${Math.round((value / 60) * 10) / 10}h`
}

export function ScheduleInsights({ insights }: { insights: MomentumFlowInsights }) {
  const items = [
    ['Focus time', minutes(insights.total_focus_minutes)],
    ['Deep work', `${insights.deep_work_percentage}%`],
    ['Switches', `${insights.context_switches}`],
    ['Breaks', minutes(insights.break_minutes)],
    ['Risk work', minutes(insights.risk_weighted_minutes)],
    ['Unscheduled', minutes(insights.unscheduled_minutes)],
  ]

  return (
    <section className="rounded-2xl border border-[#eadfce] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Schedule Insights</p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-[#fbf7f0] p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a7f72]">{label}</p>
            <p className="mt-1 text-lg font-semibold text-[#2d241c]">{value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
