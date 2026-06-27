'use client'

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, Wand2 } from 'lucide-react'

import { RecoveryActionList } from '@/components/recovery/RecoveryActionList'
import { RecoveryCard } from '@/components/recovery/RecoveryCard'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { notify } from '@/lib/notify'
import type { RecoveryPlan } from '@/lib/momentum/recovery-service'
import type { WorkspaceHealthSnapshot } from '@/lib/momentum/health-snapshot'

type RecoveryEligibility = {
  should_generate: boolean
  reasons: string[]
  health: WorkspaceHealthSnapshot
}

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
  const [eligibility, setEligibility] = useState<RecoveryEligibility | null>(null)
  const [showExploration, setShowExploration] = useState(false)
  const latestPlan = plans[0] ?? null

  useEffect(() => {
    let mounted = true
    async function loadEligibility() {
      const response = await fetch(`/api/projects/${projectId}/execution-score`, { cache: 'no-store' })
      const payload = await readResponsePayload<{ recovery_eligibility: RecoveryEligibility } | { error: string }>(response)
      if (mounted && response.ok && payload && 'recovery_eligibility' in payload) {
        setEligibility(payload.recovery_eligibility)
      }
    }
    void loadEligibility()
    return () => {
      mounted = false
    }
  }, [projectId])

  async function generatePlan() {
    setGenerating(true)
    try {
      const force = Boolean(eligibility && !eligibility.should_generate)
      const response = await fetch(`/api/projects/${projectId}/recovery-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const payload = await readResponsePayload<RecoveryPlan | { error: string }>(response)

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, 'Could not generate recovery plan.'))
      }

      const plan = payload as RecoveryPlan
      setPlans((current) => [plan, ...current])
      if (force) setShowExploration(true)
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
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#1f2937]">
            {eligibility && !eligibility.should_generate ? 'Execution health is on track' : 'Recover execution health'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6b5f52]">
            {eligibility && !eligibility.should_generate
              ? 'No intervention is required. You can still explore optional ways to protect current momentum.'
              : 'Generate deterministic recovery actions from risk, score, health, task load, and deadline pressure.'}
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
            {eligibility && !eligibility.should_generate ? 'Explore recovery options' : latestPlan ? 'Regenerate' : 'Generate recovery'}
          </button>
        )}
      </div>

      <div className="mt-5">
        {eligibility && !eligibility.should_generate && !showExploration ? (
          <div className="rounded-2xl border border-[#cfe3d7] bg-[#eef5f0] p-5">
            <p className="text-lg font-semibold text-[#2f6b4f]">Project is healthy.</p>
            <p className="mt-1 text-sm text-[#527461]">No recovery actions needed.</p>
          </div>
        ) : latestPlan ? (
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
