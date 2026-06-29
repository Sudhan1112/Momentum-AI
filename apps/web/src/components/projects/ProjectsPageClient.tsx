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
  return value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : 'Not set'
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
    return () => { mounted = false }
  }, [router])

  const visible = useMemo(() => projects
    .filter((project) => `${project.title} ${project.description ?? ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => (sortAsc ? 1 : -1) * a.title.localeCompare(b.title)), [projects, search, sortAsc])

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    const response = await fetch('/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title, description:description || null, target_deadline:targetDeadline ? new Date(targetDeadline).toISOString() : null }) })
    const payload = await readResponsePayload<ProjectListItem | { error:string }>(response)
    if (!response.ok) notify.error(getResponseErrorMessage(payload, 'Could not create project'))
    else { notify.success('Project created'); setDialog(false); setTitle(''); setDescription(''); setTargetDeadline(''); await loadProjects() }
    setCreating(false)
  }

  return <AppShell>
    <main className="fluent-page pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="fluent-kicker">Portfolio</p><h1 className="mt-1 text-2xl font-semibold">Projects</h1><p className="mt-1 text-sm text-[#616161]">Track schedules, delivery health, and team progress.</p></div>
        <button className="fluent-button" onClick={() => setDialog(true)}><Plus className="h-4 w-4" /> New project</button>
      </div>
      <section className="fluent-card mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#e0e0e0] p-3">
          <label className="flex h-8 min-w-64 flex-1 items-center gap-2 rounded border border-[#c7c7c7] px-2"><Search className="h-4 w-4 text-[#616161]" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 flex-1 outline-none" placeholder="Search projects" /></label>
          <button className="fluent-button-secondary" onClick={() => setSortAsc((v) => !v)}><ArrowUpDown className="h-4 w-4" /> Name</button>
          <span className="ml-auto text-xs text-[#616161]">{visible.length} projects</span>
        </div>
        {loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#0f6cbd]" /></div> :
        visible.length === 0 ? <div className="p-12 text-center"><p className="font-semibold">No projects found</p><p className="mt-1 text-sm text-[#616161]">Create a project or change your search.</p></div> :
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="h-9 border-b bg-[#fafafa] text-left text-xs text-[#616161]"><th className="px-4">Project name</th><th>Status</th><th>Owner</th><th>Progress</th><th>Open</th><th>Risk</th><th>Target date</th></tr></thead><tbody>
          {visible.map((project) => { const progress = project.task_counts.total ? Math.round(project.task_counts.done/project.task_counts.total*100) : 0; return <tr key={project.id} className="h-14 border-b border-[#ededed] hover:bg-[#f7f9fb]">
            <td className="px-4"><Link href={`/projects/${project.id}`} className="font-semibold text-[#0f6cbd] hover:underline">{project.title}</Link><p className="max-w-xs truncate text-xs text-[#616161]">{project.description || 'No description'}</p></td>
            <td><span className="rounded-full bg-[#ebf3fc] px-2 py-1 text-xs font-semibold capitalize text-[#0f6cbd]">{project.status}</span></td>
            <td>{project.owner?.full_name || project.owner?.email || '—'}</td>
            <td><div className="flex items-center gap-2"><div className="h-1.5 w-24 rounded bg-[#e0e0e0]"><div className="h-full rounded bg-[#0f6cbd]" style={{width:`${progress}%`}} /></div><span className="text-xs">{progress}%</span></div></td>
            <td>{project.task_counts.open}</td><td><span className={project.task_counts.overdue || project.task_counts.blocked ? 'font-semibold text-[#c50f1f]' : 'text-[#107c10]'}>{project.task_counts.overdue || project.task_counts.blocked ? `${project.task_counts.overdue + project.task_counts.blocked} issues` : 'On track'}</span></td><td>{date(project.target_deadline)}</td>
          </tr> })}</tbody></table></div>}
      </section>
    </main>
    {dialog && <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"><form onSubmit={createProject} className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-[#e0e0e0] px-5 py-4"><h2 className="text-lg font-semibold">Create project</h2><button type="button" onClick={() => setDialog(false)} className="rounded p-1 hover:bg-[#f5f5f5]"><X className="h-4 w-4" /></button></header>
      <div className="space-y-4 p-5"><label className="block"><span className="mb-1 block text-sm font-semibold">Project name</span><input className="fluent-input w-full" required value={title} onChange={(e) => setTitle(e.target.value)} /></label><label className="block"><span className="mb-1 block text-sm font-semibold">Description</span><textarea className="min-h-24 w-full rounded border border-[#c7c7c7] p-2 outline-none focus:border-[#0f6cbd]" value={description} onChange={(e) => setDescription(e.target.value)} /></label><label className="block"><span className="mb-1 block text-sm font-semibold">Target date</span><input className="fluent-input w-full" type="date" value={targetDeadline} onChange={(e) => setTargetDeadline(e.target.value)} /></label></div>
      <footer className="flex justify-end gap-2 border-t border-[#e0e0e0] px-5 py-3"><button type="button" className="fluent-button-secondary" onClick={() => setDialog(false)}>Cancel</button><button className="fluent-button" disabled={creating || !title.trim()}>{creating && <Loader2 className="h-4 w-4 animate-spin" />} Create</button></footer>
    </form></div>}
  </AppShell>
}
