import { CalendarDays } from 'lucide-react'

import { AppShell } from '@/components/shell/AppShell'

export default function PlannerPage() {
  return (
    <AppShell>
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-4xl rounded-2xl border border-[#eadfce] bg-white/76 p-8 shadow-[0_18px_44px_rgba(83,67,48,0.06)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f3ede2] text-[#9a5b2b]">
            <CalendarDays className="h-6 w-6" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Planner</p>
          <h1 className="mt-3 text-3xl font-light tracking-tight text-[#2d241c]" style={{ fontFamily: 'Newsreader, Georgia, serif' }}>
            Today view is queued.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6b5f52]">
            The execution dashboard is already using today&apos;s deterministic planner data.
          </p>
        </section>
      </main>
    </AppShell>
  )
}
