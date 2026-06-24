import { Sparkles } from 'lucide-react'

import { AppShell } from '@/components/shell/AppShell'

export default function MomentumPage() {
  return (
    <AppShell>
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-4xl rounded-2xl border border-[#eadfce] bg-white/76 p-8 shadow-[0_18px_44px_rgba(83,67,48,0.06)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2d241c] text-[#f3debf]">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Momentum</p>
          <h1 className="mt-3 text-3xl font-light tracking-tight text-[#2d241c]" style={{ fontFamily: 'Newsreader, Georgia, serif' }}>
            Brief history arrives later.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6b5f52]">
            Sprint 2 keeps Momentum deterministic and centered on the home brief.
          </p>
        </section>
      </main>
    </AppShell>
  )
}
