import { Activity, AlertTriangle, CheckCircle2, CircleDot, FolderKanban } from 'lucide-react'

import type { PlannerToday } from '@/lib/momentum/planner/planner-service'

const METRIC_ITEMS = [
  { key: 'open_tasks', label: 'Open', icon: CircleDot },
  { key: 'due_today', label: 'Due today', icon: Activity },
  { key: 'overdue', label: 'Overdue', icon: AlertTriangle },
  { key: 'completed', label: 'Done', icon: CheckCircle2 },
] as const

export function BriefHero({ brief }: { brief: PlannerToday['brief'] }) {
  return (
    <section className="rounded-2xl border border-[#eadfce] bg-[#2d241c] p-6 text-white shadow-[0_24px_70px_rgba(83,67,48,0.18)]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#f3debf]">
            <FolderKanban className="h-3.5 w-3.5" />
            Morning brief
          </div>
          <h1 className="mt-5 text-3xl font-light tracking-tight sm:text-5xl" style={{ fontFamily: 'Newsreader, Georgia, serif' }}>
            {brief.headline}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#f3e7d7]">{brief.narrative}</p>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[460px]">
          {METRIC_ITEMS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="rounded-xl border border-white/10 bg-white/8 p-3">
              <div className="flex items-center gap-2 text-[#f3debf]">
                <Icon className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-[0.16em]">{label}</span>
              </div>
              <p className="mt-3 text-2xl font-semibold">{brief.metrics[key]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
