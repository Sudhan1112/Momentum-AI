import { Gauge } from 'lucide-react'

function toneFor(score: number) {
  if (score >= 80) return { stroke: '#2f6b4f', bg: '#dceee3', label: 'Strong' }
  if (score >= 60) return { stroke: '#9a5b2b', bg: '#f0dcc0', label: 'Steady' }
  if (score >= 40) return { stroke: '#b65f2a', bg: '#f5d7c6', label: 'Attention' }
  return { stroke: '#a33a2b', bg: '#f0c8bf', label: 'Critical' }
}

export function ExecutionScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(100, score))
  const tone = toneFor(progress)

  return (
    <div className="inline-flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke={tone.bg} strokeWidth="12" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={tone.stroke}
            strokeLinecap="round"
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (progress / 100) * circumference}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-[#2d241c]">{progress}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a7f72]">Score</span>
        </div>
      </div>
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-[#f3ede2] px-3 py-1 text-xs font-bold text-[#9a5b2b]">
          <Gauge className="h-3.5 w-3.5" />
          {tone.label}
        </div>
        <p className="mt-2 max-w-[12rem] text-sm leading-5 text-[#6b5f52]">Execution score from completion, overdue control, active flow, and velocity.</p>
      </div>
    </div>
  )
}
