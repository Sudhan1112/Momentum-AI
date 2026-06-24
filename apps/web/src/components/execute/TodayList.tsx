import Link from 'next/link'
import { AlertCircle, Ban, CheckCircle2, CircleDot, Timer } from 'lucide-react'

import type { PlannerTask, PlannerToday } from '@/lib/momentum/planner/planner-service'

const SECTION_META = [
  { key: 'overdue', label: 'Overdue', icon: AlertCircle, tone: 'text-[#a33a2b]' },
  { key: 'due_today', label: 'Due today', icon: Timer, tone: 'text-[#9a5b2b]' },
  { key: 'in_progress', label: 'In progress', icon: CircleDot, tone: 'text-[#2f6b4f]' },
  { key: 'blocked', label: 'Blocked', icon: Ban, tone: 'text-[#7f3d2b]' },
] as const

function priorityClasses(priority: PlannerTask['priority']) {
  if (priority === 'urgent') return 'bg-[#fff0ed] text-[#a33a2b]'
  if (priority === 'high') return 'bg-[#fff6e7] text-[#9a5b2b]'
  if (priority === 'medium') return 'bg-[#edf7f1] text-[#2f6b4f]'
  return 'bg-[#f1f3f4] text-[#5f6368]'
}

function TaskRow({ task }: { task: PlannerTask }) {
  return (
    <Link
      href={`/projects/${task.project_id}`}
      className="block rounded-xl border border-[#efe5d6] bg-white/76 px-4 py-3 transition hover:border-[#d8c5aa] hover:bg-white"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#2d241c]">{task.title}</p>
          <p className="mt-1 truncate text-xs text-[#7b746b]">{task.project_title}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${priorityClasses(task.priority)}`}>
          {task.priority}
        </span>
      </div>
    </Link>
  )
}

export function TodayList({ sections }: { sections: PlannerToday['sections'] }) {
  const total = SECTION_META.reduce((count, section) => count + sections[section.key].length, 0)

  return (
    <section className="rounded-2xl border border-[#eadfce] bg-white/76 p-6 shadow-[0_18px_44px_rgba(83,67,48,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Today</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#2d241c]">Execution queue</h2>
        </div>
        <span className="rounded-full bg-[#f3ede2] px-3 py-1 text-xs font-bold text-[#9a5b2b]">{total} tasks</span>
      </div>

      {total === 0 ? (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-dashed border-[#d7c6ad] bg-[#fbf7f0] p-4 text-sm text-[#6b5f52]">
          <CheckCircle2 className="h-5 w-5 text-[#2f6b4f]" />
          No dated or active tasks need attention today.
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {SECTION_META.map(({ key, label, icon: Icon, tone }) => {
            const tasks = sections[key]
            if (tasks.length === 0) return null

            return (
              <div key={key}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${tone}`} />
                  <h3 className="text-sm font-bold text-[#2d241c]">{label}</h3>
                  <span className="text-xs text-[#8a7f72]">{tasks.length}</span>
                </div>
                <div className="space-y-2">
                  {tasks.slice(0, 4).map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
