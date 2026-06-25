'use client'

import { CheckSquare, Lock, SkipForward, Square, TimerReset, CheckCircle2 } from 'lucide-react'

import type { MomentumFlowSession } from '@/lib/momentum/scheduler/momentum-flow-service'

type FocusSessionCardProps = {
  session: MomentumFlowSession
  selectable?: boolean
  selected?: boolean
  onToggle?: () => void
  onLock?: () => void
  onMove?: () => void
  onComplete?: () => void
  onSkip?: () => void
}

function time(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function typeLabel(value: string) {
  return value.replace(/_/g, ' ')
}

function typeClass(value: string) {
  if (value === 'deep_work') return 'bg-[#eef5f0] text-[#2f6b4f]'
  if (value === 'quick_win') return 'bg-[#fff6dc] text-[#8a5b00]'
  if (value === 'break') return 'bg-[#f3ede2] text-[#6b5f52]'
  return 'bg-white text-[#6b5f52]'
}

function energyClass(value: string) {
  if (value === 'high') return 'text-[#a33a2b]'
  if (value === 'medium') return 'text-[#9a5b2b]'
  return 'text-[#2f6b4f]'
}

export function FocusSessionCard({
  session,
  selectable,
  selected,
  onToggle,
  onLock,
  onMove,
  onComplete,
  onSkip,
}: FocusSessionCardProps) {
  const isApplied = session.status !== 'proposed'

  return (
    <div className="rounded-2xl border border-[#eadfce] bg-white p-4">
      <div className="flex items-start gap-3">
        {selectable && (
          <button
            type="button"
            onClick={onToggle}
            className={`mt-1 inline-flex h-5 w-5 flex-none items-center justify-center rounded-md border ${
              selected ? 'border-[#2f6b4f] bg-[#2f6b4f] text-white' : 'border-[#c9b99f] bg-white text-[#c9b99f]'
            }`}
            aria-label={selected ? 'Deselect session' : 'Select session'}
          >
            {selected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[#2d241c]">{session.title}</p>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${typeClass(session.session_type)}`}>
              {typeLabel(session.session_type)}
            </span>
            <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${energyClass(session.energy_requirement)}`}>
              {session.energy_requirement} energy
            </span>
          </div>

          <p className="mt-2 text-sm font-semibold text-[#6b5f52]">
            {time(session.start_at)}-{time(session.end_at)} - {session.duration_minutes}m
          </p>
          {session.project_title && <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[#8a7f72]">{session.project_title}</p>}
          <p className="mt-2 text-sm leading-5 text-[#6b5f52]">{session.rationale}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#fbf7f0] px-2.5 py-1 text-[11px] font-bold text-[#6b5f52]">Score {session.score}</span>
            <span className="rounded-full bg-[#fbf7f0] px-2.5 py-1 text-[11px] font-bold capitalize text-[#6b5f52]">{session.status}</span>
            {session.is_locked && <span className="rounded-full bg-[#f3ede2] px-2.5 py-1 text-[11px] font-bold text-[#6b5f52]">Locked</span>}
          </div>

          {isApplied && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={onLock} className="inline-flex items-center gap-1 rounded-xl border border-[#e7dece] bg-white px-3 py-1.5 text-xs font-bold text-[#6b5f52]">
                <Lock className="h-3.5 w-3.5" />
                Lock
              </button>
              <button type="button" onClick={onMove} className="inline-flex items-center gap-1 rounded-xl border border-[#e7dece] bg-white px-3 py-1.5 text-xs font-bold text-[#6b5f52]">
                <TimerReset className="h-3.5 w-3.5" />
                +30m
              </button>
              <button type="button" onClick={onComplete} className="inline-flex items-center gap-1 rounded-xl border border-[#e7dece] bg-white px-3 py-1.5 text-xs font-bold text-[#2f6b4f]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Complete
              </button>
              <button type="button" onClick={onSkip} className="inline-flex items-center gap-1 rounded-xl border border-[#e7dece] bg-white px-3 py-1.5 text-xs font-bold text-[#8a5b00]">
                <SkipForward className="h-3.5 w-3.5" />
                Skip
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
