import Link from 'next/link'
import { AlertTriangle, ArrowRight, Ban, CheckCircle2, Timer } from 'lucide-react'

import type { PlannerProjectPulse } from '@/lib/momentum/planner/planner-service'

function attentionMeta(attention: PlannerProjectPulse['attention']) {
  if (attention === 'overdue') return { label: 'Overdue', icon: AlertTriangle, className: 'bg-[#fff0ed] text-[#a33a2b]' }
  if (attention === 'blocked') return { label: 'Blocked', icon: Ban, className: 'bg-[#fff4ef] text-[#7f3d2b]' }
  if (attention === 'due_today') return { label: 'Due today', icon: Timer, className: 'bg-[#fff6e7] text-[#9a5b2b]' }
  return { label: 'Clear', icon: CheckCircle2, className: 'bg-[#edf7f1] text-[#2f6b4f]' }
}

function deadlineLabel(deadline: string | null) {
  if (!deadline) return 'No deadline'
  return new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ProjectsPulse({ projects }: { projects: PlannerProjectPulse[] }) {
  return (
    <section className="rounded-2xl border border-[#eadfce] bg-white/76 p-6 shadow-[0_18px_44px_rgba(83,67,48,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Projects pulse</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#2d241c]">Active work</h2>
        </div>
        <Link href="/projects" className="inline-flex items-center gap-2 text-sm font-bold text-[#9a5b2b] hover:text-[#854d24]">
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[#d7c6ad] bg-[#fbf7f0] p-5 text-sm leading-6 text-[#6b5f52]">
          Create a project to start seeing execution pressure here.
        </div>
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.slice(0, 6).map((project) => {
            const meta = attentionMeta(project.attention)
            const Icon = meta.icon
            const total = project.open_tasks + project.completed_tasks
            const progress = total === 0 ? 0 : Math.round((project.completed_tasks / total) * 100)

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-xl border border-[#efe5d6] bg-white/82 p-4 transition hover:border-[#d8c5aa] hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-[#2d241c]">{project.title}</h3>
                    <p className="mt-1 text-xs text-[#7b746b]">{deadlineLabel(project.target_deadline)}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${meta.className}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </span>
                </div>

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#efe5d6]">
                  <div className="h-full rounded-full bg-[#9a5b2b]" style={{ width: `${progress}%` }} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-[#fbf7f0] px-2 py-2">
                    <p className="text-sm font-bold text-[#2d241c]">{project.open_tasks}</p>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[#8a7f72]">Open</p>
                  </div>
                  <div className="rounded-lg bg-[#fbf7f0] px-2 py-2">
                    <p className="text-sm font-bold text-[#2d241c]">{project.due_today_tasks}</p>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[#8a7f72]">Today</p>
                  </div>
                  <div className="rounded-lg bg-[#fbf7f0] px-2 py-2">
                    <p className="text-sm font-bold text-[#2d241c]">{project.blocked_tasks}</p>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[#8a7f72]">Blocked</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
