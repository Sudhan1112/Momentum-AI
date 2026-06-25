'use client'

import { Loader2, Sparkles } from 'lucide-react'

import type { MomentumFlowExplanation } from '@/lib/momentum/scheduler/momentum-flow-service'

export function MomentumFlowWhyPanel({
  explanation,
  loading,
  onExplain,
}: {
  explanation: MomentumFlowExplanation | null
  loading: boolean
  onExplain: () => void
}) {
  return (
    <section className="rounded-2xl border border-[#eadfce] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Why?</p>
          <p className="mt-1 text-sm text-[#6b5f52]">Ask Momentum to explain this deterministic schedule.</p>
        </div>
        <button
          type="button"
          onClick={onExplain}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d8c5aa] bg-white px-4 py-2 text-sm font-bold text-[#6b4a30] transition hover:border-[#9a5b2b] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Explain Flow
        </button>
      </div>

      {explanation && (
        <div className="mt-4 rounded-2xl bg-[#fbf7f0] p-4 text-sm leading-6 text-[#5f554b]">
          <p>{explanation.explanation}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {explanation.ai_run_id && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#2f6b4f]">AI run logged</span>}
            {explanation.mode === 'fallback' && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#6b5f52]">Fallback</span>}
          </div>
        </div>
      )}
    </section>
  )
}
