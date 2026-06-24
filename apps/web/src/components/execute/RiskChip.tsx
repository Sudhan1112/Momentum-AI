import { AlertTriangle, CheckCircle2, Flame, ShieldAlert } from 'lucide-react'

import type { TaskRiskScore } from '@/lib/momentum/risk-scorer'

const META = {
  low: {
    label: 'Low risk',
    className: 'bg-[#edf7f1] text-[#2f6b4f] border-[#d8ebdf]',
    icon: CheckCircle2,
  },
  medium: {
    label: 'Medium risk',
    className: 'bg-[#fff6e7] text-[#9a5b2b] border-[#f0dcc0]',
    icon: AlertTriangle,
  },
  high: {
    label: 'High risk',
    className: 'bg-[#fff0ed] text-[#a33a2b] border-[#f0c8bf]',
    icon: ShieldAlert,
  },
  critical: {
    label: 'Critical risk',
    className: 'bg-[#3a1f18] text-[#ffe2d8] border-[#6e3a2d]',
    icon: Flame,
  },
} as const

export function RiskChip({ risk, compact = false }: { risk: TaskRiskScore; compact?: boolean }) {
  const meta = META[risk.level]
  const Icon = meta.icon

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${meta.className}`}>
      <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {compact ? risk.score_100 : `${meta.label} ${risk.score_100}`}
    </span>
  )
}
