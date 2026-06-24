'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FolderKanban, Loader2, Plus } from 'lucide-react'

import { ProjectCard } from '@/components/projects/ProjectCard'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { notify } from '@/lib/notify'
import { createClient } from '@/lib/supabase/client'
import type { ProjectListItem } from '@/types/project'

export function ProjectsPageClient() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDeadline, setTargetDeadline] = useState('')

  async function loadProjects() {
    setLoading(true)
    const response = await fetch('/api/projects', { cache: 'no-store' })
    const payload = await readResponsePayload<ProjectListItem[] | { error: string }>(response)

    if (!response.ok) {
      notify.error(getResponseErrorMessage(payload, 'Could not load projects'))
      setLoading(false)
      return
    }

    setProjects(Array.isArray(payload) ? payload : [])
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      if (!data.user) {
        router.push('/login')
        return
      }
      loadProjects()
    })

    return () => {
      mounted = false
    }
  }, [router])

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

    if (!response.ok) {
      notify.error(getResponseErrorMessage(payload, 'Could not create project'))
      setCreating(false)
      return
    }

    notify.success('Project created')
    setTitle('')
    setDescription('')
    setTargetDeadline('')
    await loadProjects()
    setCreating(false)
  }

  return (
    <main
      className="min-h-screen px-5 py-8 text-[#1f2937] sm:px-8 lg:px-12"
      style={{ background: 'linear-gradient(135deg, #f7f2e9 0%, #fbf7f0 48%, #efe7db 100%)' }}
    >
      <div className="pointer-events-none fixed -left-[12%] top-[-10%] h-[48vh] w-[42vw] rounded-full bg-[#c57b3f]/20 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-[-12%] right-[-10%] h-[40vh] w-[36vw] rounded-full bg-[#2f6b4f]/15 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#7b746b] hover:text-[#9a5b2b]">
              <ArrowLeft className="h-4 w-4" />
              Back to Lumina Write
            </Link>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#9a5b2b] text-white shadow-lg">
                <FolderKanban className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8a7f72]">Sprint 1</p>
                <h1 className="text-4xl font-light tracking-tight sm:text-5xl" style={{ fontFamily: 'Newsreader, Georgia, serif' }}>
                  Projects
                </h1>
              </div>
            </div>
          </div>
          <div className="rounded-full border border-[#e7dece] bg-white/70 px-4 py-2 text-sm font-semibold text-[#6b5f52]">
            {projects.length} active workspace{projects.length === 1 ? '' : 's'}
          </div>
        </header>

        <section className="mt-10 grid gap-6 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={createProject}
            className="h-fit rounded-[32px] border border-[#e7dece] bg-white/85 p-6 shadow-[0_18px_44px_rgba(83,67,48,0.08)] backdrop-blur"
          >
            <h2 className="text-xl font-semibold tracking-tight">Create project</h2>
            <p className="mt-2 text-sm leading-6 text-[#6b5f52]">
              Keep this simple: one project, a clear target, and a small set of visible tasks.
            </p>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-widest text-[#7b746b]">Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#e7dece] bg-[#fbfaf7] px-4 py-3 text-sm outline-none focus:border-[#9a5b2b]"
                  placeholder="Launch Momentum"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-widest text-[#7b746b]">Brief</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-2 min-h-28 w-full rounded-2xl border border-[#e7dece] bg-[#fbfaf7] px-4 py-3 text-sm outline-none focus:border-[#9a5b2b]"
                  placeholder="What must be true for this project to feel done?"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-widest text-[#7b746b]">Deadline</span>
                <input
                  type="date"
                  value={targetDeadline}
                  onChange={(event) => setTargetDeadline(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#e7dece] bg-[#fbfaf7] px-4 py-3 text-sm outline-none focus:border-[#9a5b2b]"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#9a5b2b] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#854d24] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create project
            </button>
          </form>

          <div>
            {loading ? (
              <div className="flex min-h-80 items-center justify-center rounded-[32px] border border-[#e7dece] bg-white/70">
                <Loader2 className="h-6 w-6 animate-spin text-[#9a5b2b]" />
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-[32px] border border-dashed border-[#d7c6ad] bg-white/60 p-10 text-center">
                <h2 className="text-2xl font-semibold">No projects yet</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#6b5f52]">
                  Create the first project on the left. Tasks and collaboration will stay inside that project.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
