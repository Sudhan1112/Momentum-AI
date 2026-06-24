'use client'

import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Users } from 'lucide-react'

import type { ProjectListItem } from '@/types/project'

function formatDate(value: string | null) {
  if (!value) return 'No deadline'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function statusLabel(value: string) {
  return value.replace(/_/g, ' ')
}

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const completion =
    project.task_counts.total === 0 ? 0 : Math.round((project.task_counts.done / project.task_counts.total) * 100)

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-[28px] border border-[#e7dece] bg-white/80 p-6 shadow-[0_18px_44px_rgba(83,67,48,0.08)] backdrop-blur transition hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(83,67,48,0.14)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full bg-[#f3ede2] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#7b5a3c]">
            {statusLabel(project.status)}
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#1f2937]">{project.title}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6b5f52]">
            {project.description || project.goal_summary || 'No project brief yet.'}
          </p>
        </div>
        <ArrowRight className="mt-2 h-5 w-5 text-[#9a5b2b] opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[#fbf7f0] p-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8a7f72]">
            <CheckCircle2 className="h-4 w-4" />
            Done
          </div>
          <p className="mt-2 text-lg font-semibold text-[#1f2937]">{completion}%</p>
        </div>
        <div className="rounded-2xl bg-[#fbf7f0] p-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8a7f72]">
            <Clock3 className="h-4 w-4" />
            Open
          </div>
          <p className="mt-2 text-lg font-semibold text-[#1f2937]">{project.task_counts.open}</p>
        </div>
        <div className="rounded-2xl bg-[#fbf7f0] p-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8a7f72]">
            <Users className="h-4 w-4" />
            Team
          </div>
          <p className="mt-2 text-lg font-semibold text-[#1f2937]">{project.members.length}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-[#eadfcd] pt-4 text-sm text-[#6b5f52]">
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          {formatDate(project.target_deadline)}
        </span>
        {project.task_counts.overdue > 0 && (
          <span className="rounded-full bg-[#fff4f1] px-3 py-1 text-xs font-bold text-[#a33a2b]">
            {project.task_counts.overdue} overdue
          </span>
        )}
      </div>
    </Link>
  )
}
