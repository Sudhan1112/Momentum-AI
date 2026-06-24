import { CheckCircle2, CircleAlert, Siren } from 'lucide-react'

import type { WorkspaceHealthSnapshot } from '@/lib/momentum/health-snapshot'

const META = {
  healthy: {
    icon: CheckCircle2,
    dot: 'bg-[#2f6b4f]',
    panel: 'border-[#cfe7d8] bg-[#f2faf5] text-[#2f6b4f]',
  },
  attention: {
    icon: CircleAlert,
    dot: 'bg-[#c9862f]',
    panel: 'border-[#efd8b8] bg-[#fff8ec] text-[#8a5a17]',
  },
  critical: {
    icon: Siren,
    dot: 'bg-[#a33a2b]',
    panel: 'border-[#efc8bf] bg-[#fff3ef] text-[#8b2f1f]',
  },
} as const

export function WorkspaceHealthIndicator({ health }: { health: WorkspaceHealthSnapshot }) {
  const meta = META[health.level]
  const Icon = meta.icon

  return (
    <section className={`rounded-2xl border p-5 ${meta.panel}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">Workspace health</p>
          <div className="mt-3 flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${meta.dot}`} />
            <h2 className="text-2xl font-semibold tracking-tight">{health.label}</h2>
          </div>
        </div>
        <Icon className="h-6 w-6 shrink-0" />
      </div>
      <ul className="mt-4 space-y-2 text-sm leading-5">
        {health.reasons.slice(0, 3).map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </section>
  )
}
