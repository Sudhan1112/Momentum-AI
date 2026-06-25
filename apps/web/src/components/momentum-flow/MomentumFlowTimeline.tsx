'use client'

import { FocusSessionCard } from '@/components/momentum-flow/FocusSessionCard'
import type { MomentumFlowSession } from '@/lib/momentum/scheduler/momentum-flow-service'

type MomentumFlowTimelineProps = {
  sessions: MomentumFlowSession[]
  selectable?: boolean
  selectedIds?: Set<string>
  onToggle?: (id: string) => void
  onLock?: (session: MomentumFlowSession) => void
  onMove?: (session: MomentumFlowSession) => void
  onComplete?: (session: MomentumFlowSession) => void
  onSkip?: (session: MomentumFlowSession) => void
}

export function MomentumFlowTimeline({
  sessions,
  selectable,
  selectedIds,
  onToggle,
  onLock,
  onMove,
  onComplete,
  onSkip,
}: MomentumFlowTimelineProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d8c5aa] bg-[#fbf7f0] p-5 text-sm text-[#6b5f52]">
        No focus sessions yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <FocusSessionCard
          key={session.id}
          session={session}
          selectable={selectable}
          selected={selectedIds?.has(session.id)}
          onToggle={() => onToggle?.(session.id)}
          onLock={() => onLock?.(session)}
          onMove={() => onMove?.(session)}
          onComplete={() => onComplete?.(session)}
          onSkip={() => onSkip?.(session)}
        />
      ))}
    </div>
  )
}
