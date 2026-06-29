'use client'

import { useMemo, useState } from 'react'
import { CalendarRange, Filter, Search } from 'lucide-react'
import type { TaskItem } from '@/types/task'

const DAY = 86_400_000
function startOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()) }
function label(value: string) { return value.replace(/_/g, ' ') }
function shortDate(value: string | null) { return value ? new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(value)) : '—' }

export function GanttWorkspace({ tasks, canWrite, onEdit }: { tasks: TaskItem[]; canWrite: boolean; onEdit: (task: TaskItem) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const dated = tasks.filter((task) => task.started_at || task.due_at)
  const allDates = dated.flatMap((task) => [task.started_at,task.due_at].filter(Boolean).map((d) => startOfDay(new Date(d!)).getTime()))
  const min = allDates.length ? Math.min(...allDates) : startOfDay(new Date()).getTime()
  const max = allDates.length ? Math.max(...allDates) : min + DAY * 13
  const rangeStart = min - DAY * 2
  const days = Math.max(14, Math.ceil((max - rangeStart) / DAY) + 3)
  const columns = Array.from({length:days},(_,i) => new Date(rangeStart + i * DAY))
  const visible = useMemo(() => tasks.filter((task) => task.title.toLowerCase().includes(query.toLowerCase()) && (status === 'all' || task.status === status)), [tasks,query,status])
  const scheduled = visible.filter((task) => task.started_at || task.due_at)
  const unscheduled = visible.filter((task) => !task.started_at && !task.due_at)

  function row(task: TaskItem) {
    const start = startOfDay(new Date(task.started_at || task.due_at!)).getTime()
    const end = startOfDay(new Date(task.due_at || task.started_at!)).getTime()
    const left = Math.max(0, (start-rangeStart)/DAY*36)
    const width = Math.max(28, ((end-start)/DAY+1)*36)
    return <button key={task.id} onClick={() => canWrite && onEdit(task)} className="group grid h-11 min-w-max grid-cols-[380px_1fr] text-left hover:bg-[#f7f9fb]">
      <span className="grid grid-cols-[32px_1fr_90px_90px] items-center border-b border-r border-[#ededed] px-2 text-xs"><span className="text-[#616161]">{tasks.indexOf(task)+1}</span><span className="truncate pr-2 font-semibold">{task.title}</span><span className="capitalize text-[#616161]">{label(task.status)}</span><span className="text-[#616161]">{shortDate(task.due_at)}</span></span>
      <span className="relative border-b border-[#ededed]" style={{width:days*36,backgroundImage:'linear-gradient(to right,#ededed 1px,transparent 1px)',backgroundSize:'36px 100%'}}>
        <span className={`absolute top-3 h-5 rounded-sm ${task.status === 'done' ? 'bg-[#107c10]' : task.status === 'blocked' ? 'bg-[#c50f1f]' : 'bg-[#0f6cbd]'}`} style={{left,width}}><span className="block truncate px-2 text-[10px] leading-5 text-white">{task.title}</span></span>
      </span>
    </button>
  }

  return <section className="fluent-card overflow-hidden">
    <div className="flex flex-wrap items-center gap-2 border-b border-[#e0e0e0] p-3">
      <CalendarRange className="h-4 w-4 text-[#0f6cbd]" /><span className="mr-2 font-semibold">Grid & timeline</span>
      <label className="flex h-8 items-center gap-2 rounded border border-[#c7c7c7] px-2"><Search className="h-3.5 w-3.5 text-[#616161]" /><input className="w-40 outline-none" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find task" /></label>
      <label className="flex h-8 items-center gap-2 rounded border border-[#c7c7c7] px-2"><Filter className="h-3.5 w-3.5 text-[#616161]" /><select className="bg-white outline-none" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="todo">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option></select></label>
    </div>
    <div className="overflow-x-auto">
      <div className="grid h-10 min-w-max grid-cols-[380px_1fr] bg-[#fafafa] text-xs font-semibold text-[#616161]">
        <span className="grid grid-cols-[32px_1fr_90px_90px] items-center border-b border-r border-[#e0e0e0] px-2"><span>#</span><span>Task name</span><span>Status</span><span>Finish</span></span>
        <span className="flex border-b border-[#e0e0e0]">{columns.map((day) => <span key={day.toISOString()} className="flex w-9 shrink-0 items-center justify-center border-r border-[#ededed]">{day.getDate()}</span>)}</span>
      </div>
      {scheduled.map(row)}
    </div>
    {unscheduled.length > 0 && <div className="border-t border-[#e0e0e0] p-3"><p className="mb-2 text-xs font-semibold uppercase text-[#616161]">Unscheduled ({unscheduled.length})</p><div className="flex flex-wrap gap-2">{unscheduled.map((task) => <button key={task.id} onClick={() => canWrite && onEdit(task)} className="rounded border border-[#c7c7c7] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#f5f5f5]">{task.title}</button>)}</div></div>}
  </section>
}
