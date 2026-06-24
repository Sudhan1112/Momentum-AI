import Link from 'next/link'
import { ArrowRight, Clock3, Play, ShieldAlert } from 'lucide-react'

import type { PlannerTask } from '@/lib/momentum/planner/planner-service'

function dueLabel(task: PlannerTask) {
  if (task.is_overdue) return 'Overdue'
  if (task.is_due_today) return 'Due today'
  if (!task.due_at) return 'No due date'
  return new Date(task.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function NextActionCard({ task }: { task: PlannerTask | null }) {
  if (!task) {
    return (
      <section className="rounded-2xl border border-dashed border-[#d7c6ad] bg-white/68 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Next action</p>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#2d241c]">No open task is waiting.</h2>
        <p className="mt-3 text-sm leading-6 text-[#6b5f52]">Add a task with a due date or start one from a project.</p>
        <Link
          href="/projects"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#9a5b2b] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#854d24]"
        >
          Open projects
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-[#eadfce] bg-white/82 p-6 shadow-[0_18px_44px_rgba(83,67,48,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Next action</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3ede2] px-3 py-1 text-xs font-bold text-[#9a5b2b]">
          <Clock3 className="h-3.5 w-3.5" />
          {dueLabel(task)}
        </span>
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[#2d241c]">{task.title}</h2>
      <p className="mt-2 text-sm font-semibold text-[#7b746b]">{task.project_title}</p>
      {task.description && <p className="mt-4 line-clamp-3 text-sm leading-6 text-[#6b5f52]">{task.description}</p>}
      {task.status === 'blocked' && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#f1d3c8] bg-[#fff4ef] p-3 text-sm text-[#8b2f1f]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{task.blocked_reason || 'Blocked'}</span>
        </div>
      )}
      <Link
        href={`/projects/${task.project_id}`}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#9a5b2b] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#854d24]"
      >
        <Play className="h-4 w-4" />
        Start
      </Link>
    </section>
  )
}
