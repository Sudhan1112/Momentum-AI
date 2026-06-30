'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpDown, Loader2, Plus, Search, X } from 'lucide-react'

import { AppShell } from '@/components/shell/AppShell'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { notify } from '@/lib/notify'
import { createClient } from '@/lib/supabase/client'
import type { ProjectListItem } from '@/types/project'

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
    : 'Not set'
}

function statusBadge(status: ProjectListItem['status']) {
  if (status === 'active') return 'fluent-badge-blue'
  if (status === 'completed') return 'fluent-badge-green'
  if (status === 'paused') return 'fluent-badge-amber'
  return 'fluent-badge-gray'
}

export function ProjectsPageClient() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [search, setSearch] = useState('')
  const [sortAsc, setSortAsc] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDeadline, setTargetDeadline] = useState('')

  async function loadProjects() {
    setLoading(true)
    const response = await fetch('/api/projects', { cache: 'no-store' })
    const payload = await readResponsePayload<ProjectListItem[] | { error: string }>(response)
    if (!response.ok) notify.error(getResponseErrorMessage(payload, 'Could not load projects'))
    else setProjects(Array.isArray(payload) ? payload : [])
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true
    createClient().auth.getUser().then(({ data }) => {
      if (!mounted) return
      if (!data.user) router.push('/login')
      else void loadProjects()
    })
    return () => {
      mounted = false
    }
  }, [router])

  const visible = useMemo(
    () =>
      projects
        .filter((project) =>
          `${project.title} ${project.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => (sortAsc ? 1 : -1) * a.title.localeCompare(b.title)),
    [projects, search, sortAsc]
  )

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description: description || null,
        target_deadline: targetDeadline ? new Date(targetDeadline).toISOString() : null,
      }),
    })
    const payload = await readResponsePayload<ProjectListItem | { error: string }>(response)
    if (!response.ok) notify.error(getResponseErrorMessage(payload, 'Could not create project'))
    else {
      notify.success('Project created')
      setDialog(false)
      setTitle('')
      setDescription('')
      setTargetDeadline('')
      await loadProjects()
    }
    setCreating(false)
  }

  return (
    <AppShell>
      <main className="fluent-page pb-24">
        <div className="workspace-hero flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="fluent-kicker">Portfolio</p>
            <h1 className="text-[32px] font-semibold tracking-[-0.035em] text-[#101828] sm:text-[38px]">Projects</h1>
            <p className="max-w-3xl text-sm leading-6 text-[#667085]">
              Track schedules, delivery health, and team progress.
            </p>
          </div>
          <button className="fluent-button" onClick={() => setDialog(true)}>
            <Plus className="h-4 w-4" />
            New project
          </button>
        </div>

        <section className="fluent-panel overflow-hidden border-[#cfe0f2]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#eaecf0] px-4 py-4">
            <label className="fluent-input-shell min-w-[280px] flex-1">
              <Search className="h-4 w-4 text-[#667085]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-[#101828] outline-none"
                placeholder="Search projects"
              />
            </label>
            <button className="fluent-button-secondary" onClick={() => setSortAsc((value) => !value)}>
              <ArrowUpDown className="h-4 w-4" />
              Name
            </button>
            <span className="ml-auto text-xs font-medium text-[#667085]">{visible.length} projects</span>
          </div>

          {loading ? (
            <div className="flex h-72 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[#0f6cbd]" />
            </div>
          ) : visible.length === 0 ? (
            <div className="p-6">
              <div className="fluent-empty">
                <p className="font-semibold text-[#101828]">No projects found</p>
                <p className="mt-1">Create a project or adjust your search to see results.</p>
              </div>
            </div>
          ) : (
            <div className="fluent-table-wrap">
              <table className="fluent-table min-w-[980px]">
                <thead>
                  <tr>
                    <th>Project name</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th>Progress</th>
                    <th>Open</th>
                    <th>Risk</th>
                    <th>Target date</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((project) => {
                    const progress = project.task_counts.total
                      ? Math.round((project.task_counts.done / project.task_counts.total) * 100)
                      : 0
                    const issues = project.task_counts.overdue + project.task_counts.blocked

                    return (
                      <tr key={project.id}>
                        <td>
                          <Link href={`/projects/${project.id}`} className="font-semibold text-[#0f6cbd] hover:underline">
                            {project.title}
                          </Link>
                          <p className="mt-1 max-w-xs truncate text-xs text-[#667085]">
                            {project.description || 'No description'}
                          </p>
                        </td>
                        <td>
                          <span className={`capitalize ${statusBadge(project.status)}`}>{project.status}</span>
                        </td>
                        <td>{project.owner?.full_name || project.owner?.email || '-'}</td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-[#e7edf4]">
                              <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,#0f6cbd_0%,#5b9bd5_100%)]"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-[#667085]">{progress}%</span>
                          </div>
                        </td>
                        <td>
                          <span className="font-medium text-[#101828]">{project.task_counts.open}</span>
                        </td>
                        <td>
                          <span className={issues ? 'fluent-badge-red' : 'fluent-badge-green'}>
                            {issues ? `${issues} issues` : 'On track'}
                          </span>
                        </td>
                        <td>{date(project.target_deadline)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {dialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <form
            onSubmit={createProject}
            className="w-full max-w-lg rounded-[24px] border border-[#dce3ec] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]"
          >
            <header className="flex items-center justify-between border-b border-[#eaecf0] px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[#101828]">Create project</h2>
                <p className="mt-1 text-sm text-[#667085]">
                  Set up a new workspace for tasks, schedules, and team delivery.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialog(false)}
                className="rounded-xl p-2 text-[#667085] hover:bg-[#f5f7fa]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="space-y-4 p-6">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[#344054]">Project name</span>
                <input
                  className="fluent-input w-full"
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[#344054]">Description</span>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-[#d0d5dd] p-3 text-sm outline-none transition hover:border-[#98a2b3] focus:border-[#0f6cbd]"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[#344054]">Target date</span>
                <input
                  className="fluent-input w-full"
                  type="date"
                  value={targetDeadline}
                  onChange={(event) => setTargetDeadline(event.target.value)}
                />
              </label>
            </div>
            <footer className="flex justify-end gap-2 border-t border-[#eaecf0] px-6 py-4">
              <button type="button" className="fluent-button-secondary" onClick={() => setDialog(false)}>
                Cancel
              </button>
              <button className="fluent-button" disabled={creating || !title.trim()}>
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </footer>
          </form>
        </div>
      )}
    </AppShell>
  )
}
