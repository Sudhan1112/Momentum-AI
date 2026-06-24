import Link from 'next/link'
import { ArrowRight, ShieldAlert } from 'lucide-react'

import { RiskChip } from '@/components/execute/RiskChip'
import type { TaskRiskScore } from '@/lib/momentum/risk-scorer'

type AtRiskItem = TaskRiskScore & {
  task_title?: string
  project_title?: string
}

export function AtRiskList({ risks }: { risks: AtRiskItem[] }) {
  const visibleRisks = risks.filter((risk) => risk.score > 0.3).slice(0, 5)

  return (
    <section className="rounded-2xl border border-[#eadfce] bg-white/76 p-6 shadow-[0_18px_44px_rgba(83,67,48,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">At risk</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#2d241c]">Failure signals</h2>
        </div>
        <ShieldAlert className="h-5 w-5 text-[#9a5b2b]" />
      </div>

      {visibleRisks.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#d7c6ad] bg-[#fbf7f0] p-4 text-sm text-[#6b5f52]">
          No high-risk tasks are active right now.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {visibleRisks.map((risk) => {
            const topFactor = risk.factors
              .filter((factor) => factor.contribution > 0)
              .sort((a, b) => b.contribution - a.contribution)[0]

            return (
              <Link
                key={risk.task_id}
                href={`/projects/${risk.project_id}`}
                className="block rounded-xl border border-[#efe5d6] bg-white/82 p-4 transition hover:border-[#d8c5aa] hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#2d241c]">{risk.task_title || 'Task'}</p>
                    {risk.project_title && <p className="mt-1 truncate text-xs text-[#7b746b]">{risk.project_title}</p>}
                  </div>
                  <RiskChip risk={risk} compact />
                </div>
                <p className="mt-3 text-sm leading-5 text-[#6b5f52]">
                  Because: {topFactor?.reason || risk.explanation}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#9a5b2b]">
                  Open project
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
