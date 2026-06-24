'use client'

import { AlertTriangle, CalendarDays, CheckCircle2, Circle, Clock3, Pencil, UserRound } from 'lucide-react'

import type { TaskItem } from '@/types/task'

const STATUS_STYLES: Record<string, string> = {
  backlog: 'bg-slate-100 text-slate-700',
  todo: 'bg-[#f3ede2] text-[#7b5a3c]',
  in_progress: 'bg-blue-50 text-blue-700',
  blocked: 'bg-[#fff4f1] text-[#a33a2b]',
  done: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-zinc-100 text-zinc-600',
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-[#fbf7f0] text-[#7b746b]',
  high: 'bg-amber-50 text-amber-700',
  urgent: 'bg-red-50 text-red-700',
}

function label(value: string) {
  return value.replace(/_/g, ' ')
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

function statusIcon(status: string) {
  if (status === 'done') return <CheckCircle2 className="h-5 w-5 text-emerald-600" />
  if (status === 'blocked') return <AlertTriangle className="h-5 w-5 text-[#a33a2b]" />
  if (status === 'in_progress') return <Clock3 className="h-5 w-5 text-blue-600" />
  return <Circle className="h-5 w-5 text-[#9a5b2b]" />
}

export function TaskList({
  tasks,
  canWrite,
  onEdit,
}: {
  tasks: TaskItem[]
  canWrite: boolean
  onEdit: (task: TaskItem) => void
}) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-[#d7c6ad] bg-white/60 p-10 text-center">
        <h2 className="text-2xl font-semibold text-[#1f2937]">No tasks yet</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#6b5f52]">
          Add the first concrete task. Keep it judge-visible, deterministic, and small enough to finish.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const dueDate = formatDate(task.due_at)
        return (
          <button
            key={task.id}
            type="button"
            onClick={() => canWrite && onEdit(task)}
            className="w-full rounded-[24px] border border-[#e7dece] bg-white/80 p-5 text-left shadow-[0_14px_34px_rgba(83,67,48,0.06)] transition hover:border-[#d3bea0] hover:bg-white disabled:cursor-default"
            disabled={!canWrite}
          >
            <div className="flex items-start gap-4">
              <div className="mt-1">{statusIcon(task.status)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-semibold text-[#1f2937]">{task.title}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS_STYLES[task.status]}`}>
                    {label(task.status)}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${PRIORITY_STYLES[task.priority]}`}>
                    {task.priority}
                  </span>
                </div>
                {task.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6b5f52]">{task.description}</p>}
                {task.blocked_reason && (
                  <p className="mt-2 rounded-2xl bg-[#fff4f1] px-3 py-2 text-sm font-medium text-[#a33a2b]">
                    {task.blocked_reason}
                  </p>
                )}
              </div>
              {canWrite && <Pencil className="mt-1 h-4 w-4 text-[#9a5b2b]" />}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 border-t border-[#eadfcd] pt-4 text-xs font-semibold text-[#7b746b]">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4" />
                {task.assignee?.full_name || task.assignee?.email || 'Unassigned'}
              </span>
              {dueDate && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {dueDate}
                </span>
              )}
              {task.estimate_minutes != null && <span>{task.estimate_minutes} min estimate</span>}
            </div>
          </button>
        )
      })}
    </div>
  )
}
