'use client'

import { ArrowRight, Gauge, ShieldCheck } from 'lucide-react'

import type { RecoveryPlan } from '@/lib/momentum/recovery-service'

function healthLabel(level: RecoveryPlan['impact']['before_health']['level']) {
  if (level === 'critical') return 'Critical'
  if (level === 'attention') return 'Needs Attention'
  return 'Healthy'
}

export function RecoveryCard({ plan }: { plan: RecoveryPlan }) {
  const impact = plan.impact

  return (
    <section className="rounded-2xl border border-[#eadfce] bg-[#2d241c] p-5 text-white shadow-[0_18px_44px_rgba(83,67,48,0.16)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f3debf]">Recovery impact</p>
          <h3 className="mt-3 text-xl font-semibold tracking-tight">{plan.summary}</h3>
        </div>
        <ShieldCheck className="h-6 w-6 shrink-0 text-[#f3debf]" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/8 p-3">
          <div className="flex items-center gap-2 text-[#f3debf]">
            <Gauge className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Execution</span>
          </div>
          <p className="mt-3 flex items-center gap-2 text-lg font-bold">
            {impact.before_execution_score}
            <ArrowRight className="h-4 w-4 text-[#f3debf]" />
            {impact.after_execution_score}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/8 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#f3debf]">Health</p>
          <p className="mt-3 flex items-center gap-2 text-sm font-bold">
            {healthLabel(impact.before_health.level)}
            <ArrowRight className="h-4 w-4 text-[#f3debf]" />
            {healthLabel(impact.after_health.level)}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/8 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#f3debf]">Success chance</p>
          <p className="mt-3 flex items-center gap-2 text-lg font-bold">
            {impact.before_success_probability}%
            <ArrowRight className="h-4 w-4 text-[#f3debf]" />
            {impact.after_success_probability}%
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/8 p-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-[#f3debf]">Recovery confidence</span>
          <span className="font-bold">{impact.confidence_score}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#f3debf]" style={{ width: `${impact.confidence_score}%` }} />
        </div>
      </div>
    </section>
  )
}
