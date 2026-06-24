'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Loader2, Trash2, X } from 'lucide-react'

import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { notify } from '@/lib/notify'
import type { ProjectMemberWithProfile } from '@/types/project'
import type { TaskItem, TaskPriority, TaskStatus } from '@/types/task'

const STATUS_VALUES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'blocked', 'done', 'cancelled']
const PRIORITY_VALUES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

function toDatetimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null
}

function label(value: string) {
  return value.replace(/_/g, ' ')
}

export function TaskDrawer({
  open,
  projectId,
  task,
  members,
  onClose,
  onSaved,
}: {
  open: boolean
  projectId: string
  task: TaskItem | null
  members: ProjectMemberWithProfile[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [estimateMinutes, setEstimateMinutes] = useState('')
  const [actualMinutes, setActualMinutes] = useState('')
  const [blockedReason, setBlockedReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setStatus(task?.status ?? 'todo')
    setPriority(task?.priority ?? 'medium')
    setAssigneeId(task?.assignee_id ?? '')
    setDueAt(toDatetimeLocal(task?.due_at ?? null))
    setEstimateMinutes(task?.estimate_minutes != null ? String(task.estimate_minutes) : '')
    setActualMinutes(task?.actual_minutes != null ? String(task.actual_minutes) : '')
    setBlockedReason(task?.blocked_reason ?? '')
  }, [task, open])

  if (!open) return null

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    const body = {
      title,
      description: description || null,
      status,
      priority,
      assignee_id: assigneeId || null,
      due_at: toIso(dueAt),
      estimate_minutes: estimateMinutes ? Number(estimateMinutes) : null,
      actual_minutes: actualMinutes ? Number(actualMinutes) : null,
      blocked_reason: blockedReason || null,
    }

    const response = await fetch(task ? `/api/tasks/${task.id}` : `/api/projects/${projectId}/tasks`, {
      method: task ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await readResponsePayload<TaskItem | { error: string }>(response)

    if (!response.ok) {
      notify.error(getResponseErrorMessage(payload, 'Could not save task'))
      setSaving(false)
      return
    }

    notify.success(task ? 'Task updated' : 'Task created')
    setSaving(false)
    onSaved()
  }

  async function deleteTask() {
    if (!task) return
    setDeleting(true)
    const response = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
    const payload = await readResponsePayload<{ success: boolean } | { error: string }>(response)

    if (!response.ok) {
      notify.error(getResponseErrorMessage(payload, 'Could not delete task'))
      setDeleting(false)
      return
    }

    notify.success('Task deleted')
    setDeleting(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#1f2937]/30 backdrop-blur-sm">
      <button type="button" aria-label="Close task drawer" className="flex-1 cursor-default" onClick={onClose} />
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-[#e7dece] bg-[#fbf7f0] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8a7f72]">Task drawer</p>
            <h2 className="mt-2 text-3xl font-light tracking-tight text-[#1f2937]" style={{ fontFamily: 'Newsreader, Georgia, serif' }}>
              {task ? 'Edit task' : 'New task'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#e7dece] bg-white p-2 text-[#6b5f52] hover:text-[#1f2937]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={saveTask} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-[#7b746b]">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#e7dece] bg-white px-4 py-3 text-sm outline-none focus:border-[#9a5b2b]"
              placeholder="Ship the smallest visible slice"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-[#7b746b]">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 min-h-28 w-full rounded-2xl border border-[#e7dece] bg-white px-4 py-3 text-sm outline-none focus:border-[#9a5b2b]"
              placeholder="What exactly needs to happen?"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-[#7b746b]">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
                className="mt-2 w-full rounded-2xl border border-[#e7dece] bg-white px-4 py-3 text-sm capitalize outline-none focus:border-[#9a5b2b]"
              >
                {STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-[#7b746b]">Priority</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
                className="mt-2 w-full rounded-2xl border border-[#e7dece] bg-white px-4 py-3 text-sm capitalize outline-none focus:border-[#9a5b2b]"
              >
                {PRIORITY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-[#7b746b]">Assignee</span>
            <select
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#e7dece] bg-white px-4 py-3 text-sm outline-none focus:border-[#9a5b2b]"
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.profile?.full_name || member.profile?.email || member.user_id}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-[#7b746b]">Due</span>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#e7dece] bg-white px-4 py-3 text-sm outline-none focus:border-[#9a5b2b]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-[#7b746b]">Estimate minutes</span>
              <input
                type="number"
                min="0"
                value={estimateMinutes}
                onChange={(event) => setEstimateMinutes(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#e7dece] bg-white px-4 py-3 text-sm outline-none focus:border-[#9a5b2b]"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-[#7b746b]">Actual minutes</span>
            <input
              type="number"
              min="0"
              value={actualMinutes}
              onChange={(event) => setActualMinutes(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#e7dece] bg-white px-4 py-3 text-sm outline-none focus:border-[#9a5b2b]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-[#7b746b]">Blocked reason</span>
            <textarea
              value={blockedReason}
              onChange={(event) => setBlockedReason(event.target.value)}
              className="mt-2 min-h-20 w-full rounded-2xl border border-[#e7dece] bg-white px-4 py-3 text-sm outline-none focus:border-[#9a5b2b]"
              placeholder="Leave empty when not blocked"
            />
          </label>

          <div className="flex flex-col gap-3 border-t border-[#e7dece] pt-5 sm:flex-row">
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#9a5b2b] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#854d24] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save task
            </button>
            {task && (
              <button
                type="button"
                onClick={deleteTask}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#f2d4cd] bg-[#fff4f1] px-5 py-3 text-sm font-bold text-[#a33a2b] transition hover:bg-[#ffe8e1] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            )}
          </div>
        </form>
      </aside>
    </div>
  )
}
