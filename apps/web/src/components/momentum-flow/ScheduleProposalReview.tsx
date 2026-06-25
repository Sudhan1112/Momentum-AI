'use client'

import { CheckCircle2 } from 'lucide-react'

import { BacklogRemainingList } from '@/components/momentum-flow/BacklogRemainingList'
import { CapacitySummary } from '@/components/momentum-flow/CapacitySummary'
import { MomentumFlowTimeline } from '@/components/momentum-flow/MomentumFlowTimeline'
import { ScheduleInsights } from '@/components/momentum-flow/ScheduleInsights'
import type { MomentumFlowProposal } from '@/lib/momentum/scheduler/momentum-flow-service'

export function ScheduleProposalReview({
  proposal,
  selectedIds,
  onToggle,
  onApply,
  applying,
}: {
  proposal: MomentumFlowProposal
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onApply: () => void
  applying: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfce] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Proposal v{proposal.version}</p>
            <h3 className="mt-1 text-xl font-semibold text-[#2d241c]">Review Momentum Flow</h3>
            <p className="mt-2 text-sm leading-6 text-[#6b5f52]">{proposal.explanation_summary}</p>
          </div>
          <span className="rounded-full bg-[#eef5f0] px-3 py-1 text-xs font-bold text-[#2f6b4f]">
            {proposal.confidence}% confidence
          </span>
        </div>
      </div>

      <CapacitySummary capacity={proposal.capacity_summary} confidence={proposal.confidence} />
      <ScheduleInsights insights={proposal.insights} />
      <MomentumFlowTimeline sessions={proposal.sessions} selectable selectedIds={selectedIds} onToggle={onToggle} />
      <BacklogRemainingList backlog={proposal.backlog_remaining} />

      <button
        type="button"
        onClick={onApply}
        disabled={applying || selectedIds.size === 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2f6b4f] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#27583f] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CheckCircle2 className="h-4 w-4" />
        Apply Selected Sessions
      </button>
    </div>
  )
}
