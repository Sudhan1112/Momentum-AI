'use client'

import { useState } from 'react'
import { Loader2, RefreshCw, Wand2 } from 'lucide-react'

import { RecoveryActionList } from '@/components/recovery/RecoveryActionList'
import { RecoveryCard } from '@/components/recovery/RecoveryCard'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { notify } from '@/lib/notify'
import type { RecoveryPlan } from '@/lib/momentum/recovery-service'

export function RecoveryFlow({
  projectId,
  initialPlans,
  canWrite,
}: {
  projectId: string
  initialPlans: RecoveryPlan[]
  canWrite: boolean
}) {
  const [plans, setPlans] = useState(initialPlans)
  const [generating, setGenerating] = useState(false)
  const latestPlan = plans[0] ?? null

  async function generatePlan() {
    setGenerating(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/recovery-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const payload = await readResponsePayload<RecoveryPlan | { error: string }>(response)

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, 'Could not generate recovery plan.'))
      }

      const plan = payload as RecoveryPlan
      setPlans((current) => [plan, ...current])
      notify.success('Recovery plan generated')
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Could not generate recovery plan.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section className="rounded-[28px] border border-[#e7dece] bg-white/75 p-5 shadow-[0_16px_40px_rgba(83,67,48,0.07)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Recovery planner</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#1f2937]">Recover execution health</h2>
          <p className="mt-2 text-sm leading-6 text-[#6b5f52]">
            Generate deterministic recovery actions from risk, score, health, task load, and deadline pressure.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={generatePlan}
            disabled={generating}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#9a5b2b] px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#854d24] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : latestPlan ? <RefreshCw className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
            {latestPlan ? 'Regenerate' : 'Generate recovery'}
          </button>
        )}
      </div>

      <div className="mt-5">
        {latestPlan ? (
          <div className="space-y-4">
            <RecoveryCard plan={latestPlan} />
            <RecoveryActionList actions={latestPlan.actions} />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#d7c6ad] bg-[#fbf7f0] p-5 text-sm leading-6 text-[#6b5f52]">
            No recovery plan has been generated for this project yet.
          </div>
        )}
      </div>
    </section>
  )
}
