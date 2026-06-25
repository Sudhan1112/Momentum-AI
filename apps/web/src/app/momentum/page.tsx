'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bot, Loader2, Sparkles, Wand2 } from 'lucide-react'

import { AppShell } from '@/components/shell/AppShell'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import type { MomentumDailyBrief } from '@/lib/momentum/ai/capabilities/morning-brief'

function healthTone(level: MomentumDailyBrief['workspace_health']['level']) {
  if (level === 'healthy') return 'bg-[#eef5f0] text-[#2f6b4f]'
  if (level === 'critical') return 'bg-[#fff0ea] text-[#a33a2b]'
  return 'bg-[#fff6dc] text-[#8a5b00]'
}

export default function MomentumPage() {
  const [brief, setBrief] = useState<MomentumDailyBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadBrief() {
      setLoading(true)
      setError(false)
      const response = await fetch('/api/momentum/brief', { cache: 'no-store' })
      const payload = await readResponsePayload<MomentumDailyBrief | { error: string }>(response)
      if (!mounted) return

      if (!response.ok) {
        console.warn(getResponseErrorMessage(payload, 'Could not load Momentum.'))
        setError(true)
        setBrief(null)
      } else {
        setBrief(payload as MomentumDailyBrief)
      }
      setLoading(false)
    }

    void loadBrief()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <AppShell>
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#7b746b] hover:text-[#9a5b2b]">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <section className="mt-5 rounded-[32px] border border-[#eadfce] bg-[#2d241c] p-7 text-[#f8f3ea] shadow-[0_18px_44px_rgba(83,67,48,0.14)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f3debf] text-[#2d241c]">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#e8d7c0]">Momentum Activity</p>
            <h1 className="mt-3 text-4xl font-light tracking-tight" style={{ fontFamily: 'Newsreader, Georgia, serif' }}>
              Your execution intelligence hub
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#e8d7c0]">
              Latest brief, workspace health, AI run trace, task extraction entry points, and recovery surfaces in one place.
            </p>
          </section>

          {loading ? (
            <div className="mt-8 flex min-h-72 items-center justify-center rounded-[28px] border border-[#eadfce] bg-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-[#9a5b2b]" />
            </div>
          ) : error ? (
            <div className="mt-8 rounded-2xl border border-[#eadfce] bg-[#fbf7f0] p-5 text-sm text-[#6b5f52]">
              Momentum activity is unavailable. Check project setup, then refresh.
            </div>
          ) : brief ? (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-[28px] border border-[#eadfce] bg-white/78 p-6 shadow-[0_16px_40px_rgba(83,67,48,0.05)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Latest Brief</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#2d241c]">{brief.welcome}</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${healthTone(brief.workspace_health.level)}`}>
                    {brief.workspace_health.label}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[#fbf7f0] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7f72]">Execution</p>
                    <p className="mt-1 text-3xl font-semibold text-[#2d241c]">{brief.execution_score.score}</p>
                  </div>
                  <div className="rounded-2xl bg-[#fbf7f0] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7f72]">Open tasks</p>
                    <p className="mt-1 text-3xl font-semibold text-[#2d241c]">{brief.metrics.open_tasks}</p>
                  </div>
                  <div className="rounded-2xl bg-[#fbf7f0] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a7f72]">At risk</p>
                    <p className="mt-1 text-3xl font-semibold text-[#2d241c]">{brief.at_risk_tasks.length}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-[#eadfce] bg-[#fbf7f0] p-4">
                  <p className="text-sm font-bold text-[#2d241c]">{brief.recommendation.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[#6b5f52]">{brief.recommendation.summary}</p>
                  <p className="mt-3 text-xs leading-5 text-[#8a7f72]">{brief.recommendation.reasoning}</p>
                </div>
              </section>

              <aside className="space-y-4">
                <section className="rounded-[28px] border border-[#eadfce] bg-white/78 p-5 shadow-[0_16px_40px_rgba(83,67,48,0.05)]">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Recent AI Run</p>
                  <div className="mt-4 rounded-2xl bg-[#fbf7f0] p-4">
                    <div className="flex items-center gap-3">
                      <Bot className="h-5 w-5 text-[#9a5b2b]" />
                      <div>
                        <p className="text-sm font-semibold text-[#2d241c]">Momentum Daily Brief</p>
                        <p className="mt-1 text-xs text-[#6b5f52]">{brief.mode === 'ai' ? 'Logged with citations' : 'Deterministic fallback'}</p>
                      </div>
                    </div>
                    {brief.ai_run_id && (
                      <p className="mt-3 break-all rounded-xl bg-white px-3 py-2 text-[11px] font-semibold text-[#8a7f72]">
                        {brief.ai_run_id}
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-[28px] border border-[#eadfce] bg-white/78 p-5 shadow-[0_16px_40px_rgba(83,67,48,0.05)]">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">AI Workflows</p>
                  <div className="mt-4 space-y-3">
                    <Link href="/projects" className="flex items-center gap-3 rounded-2xl bg-[#fbf7f0] p-4 transition hover:bg-[#f3ede2]">
                      <Wand2 className="h-5 w-5 text-[#9a5b2b]" />
                      <div>
                        <p className="text-sm font-semibold text-[#2d241c]">Task Extraction</p>
                        <p className="mt-1 text-xs text-[#6b5f52]">Open a project to convert notes into reviewable tasks.</p>
                      </div>
                    </Link>
                    <Link href="/projects" className="flex items-center gap-3 rounded-2xl bg-[#fbf7f0] p-4 transition hover:bg-[#f3ede2]">
                      <Sparkles className="h-5 w-5 text-[#9a5b2b]" />
                      <div>
                        <p className="text-sm font-semibold text-[#2d241c]">Recovery Plans</p>
                        <p className="mt-1 text-xs text-[#6b5f52]">Review recovery options from project pages when health drops.</p>
                      </div>
                    </Link>
                  </div>
                </section>
              </aside>
            </div>
          ) : null}
        </div>
      </main>
    </AppShell>
  )
}
