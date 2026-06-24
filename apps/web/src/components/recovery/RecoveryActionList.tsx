'use client'

import { ArrowRight, CalendarClock, Flag, ListTree, PlayCircle, ShieldCheck } from 'lucide-react'

import type { RecoveryAction } from '@/lib/momentum/recovery-service'

const ICONS = {
  reschedule_task: CalendarClock,
  reprioritize_task: Flag,
  split_overloaded_work: ListTree,
  reduce_deadline_risk: ShieldCheck,
  start_task: PlayCircle,
} as const

function actionLabel(type: RecoveryAction['type']) {
  return type.replace(/_/g, ' ')
}

export function RecoveryActionList({ actions }: { actions: RecoveryAction[] }) {
  if (actions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d7c6ad] bg-[#fbf7f0] p-4 text-sm text-[#6b5f52]">
        No recovery actions were needed for this project.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {actions.map((action) => {
        const Icon = ICONS[action.type]
        return (
          <div key={action.id} className="rounded-2xl border border-[#eadfce] bg-white/82 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f3ede2] text-[#9a5b2b]">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#fbf7f0] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a7f72]">
                    {actionLabel(action.type)}
                  </span>
                  {action.from !== undefined && action.to !== undefined && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#7b746b]">
                      {action.from || 'Unset'}
                      <ArrowRight className="h-3 w-3" />
                      {action.to}
                    </span>
                  )}
                </div>
                <h4 className="mt-2 truncate text-sm font-bold text-[#2d241c]">{action.task_title}</h4>
                <p className="mt-2 text-sm leading-5 text-[#6b5f52]">{action.reason}</p>
                <p className="mt-1 text-xs font-semibold text-[#2f6b4f]">{action.impact}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
