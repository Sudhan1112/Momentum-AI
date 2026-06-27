'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarDays, Loader2, Plus, Telescope, Users } from 'lucide-react'

import { MomentumFlowPanel } from '@/components/momentum-flow/MomentumFlowPanel'
import { MomentumMemoryPanel } from '@/components/projects/MomentumMemoryPanel'
import { RecoveryFlow } from '@/components/recovery/RecoveryFlow'
import { SimulationModal } from '@/components/simulation/SimulationModal'
import { TaskDrawer } from '@/components/tasks/TaskDrawer'
import { TaskExtractionPanel } from '@/components/tasks/TaskExtractionPanel'
import { TaskList } from '@/components/tasks/TaskList'
import { WorkBreakdownPanel } from '@/components/tasks/WorkBreakdownPanel'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { notify } from '@/lib/notify'
import { createClient } from '@/lib/supabase/client'
import type { RecoveryPlan } from '@/lib/momentum/recovery-service'
import type { AppRole, ProjectDetail } from '@/types/project'
import type { TaskItem } from '@/types/task'

type ProjectPayload = ProjectDetail & {
  current_user_role: AppRole
}

type TasksPayload = {
  role: AppRole
  tasks: TaskItem[]
}

const WRITE_ROLES = new Set<AppRole>(['owner', 'admin', 'editor'])

function formatDate(value: string | null) {
  if (!value) return 'No deadline'
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function statusLabel(value: string) {
  return value.replace(/_/g, ' ')
}

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [project, setProject] = useState<ProjectPayload | null>(null)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [recoveryPlans, setRecoveryPlans] = useState<RecoveryPlan[]>([])
  const [role, setRole] = useState<AppRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null)
  const [simulationOpen, setSimulationOpen] = useState(false)
  const [memoryRefreshKey, setMemoryRefreshKey] = useState(0)

  const canWrite = useMemo(() => (role ? WRITE_ROLES.has(role) : false), [role])

  const loadProject = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}`, { cache: 'no-store' })
    const payload = await readResponsePayload<ProjectPayload | { error: string }>(response)

    if (!response.ok) {
      notify.error(getResponseErrorMessage(payload, 'Could not load project'))
      router.push('/projects')
      return null
    }

    const nextProject = payload as ProjectPayload
    setProject(nextProject)
    setRole(nextProject.current_user_role)
    return nextProject
  }, [projectId, router])

  const loadTasks = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/tasks`, { cache: 'no-store' })
    const payload = await readResponsePayload<TasksPayload | { error: string }>(response)

    if (!response.ok) {
      notify.error(getResponseErrorMessage(payload, 'Could not load tasks'))
      return
    }

    const nextPayload = payload as TasksPayload
    setTasks(nextPayload.tasks)
    setRole(nextPayload.role)
  }, [projectId])

  const loadRecoveryPlans = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/recovery-plans`, { cache: 'no-store' })
    const payload = await readResponsePayload<RecoveryPlan[] | { error: string }>(response)

    if (!response.ok) {
      notify.error(getResponseErrorMessage(payload, 'Could not load recovery plans'))
      return
    }

    setRecoveryPlans(Array.isArray(payload) ? payload : [])
  }, [projectId])

  const refresh = useCallback(async () => {
    setLoading(true)
    await loadProject()
    await loadTasks()
    await loadRecoveryPlans()
    setLoading(false)
    setMemoryRefreshKey((current) => current + 1)
  }, [loadProject, loadRecoveryPlans, loadTasks])

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      if (!data.user) {
        router.push('/login')
        return
      }
      refresh()
    })

    return () => {
      mounted = false
    }
  }, [refresh, router])

  function openNewTask() {
    setEditingTask(null)
    setDrawerOpen(true)
  }

  function openEditTask(task: TaskItem) {
    setEditingTask(task)
    setDrawerOpen(true)
  }

  async function handleTaskSaved() {
    setDrawerOpen(false)
    setEditingTask(null)
    await refresh()
  }

  const doneCount = tasks.filter((task) => task.status === 'done').length
  const blockedCount = tasks.filter((task) => task.status === 'blocked').length

  return (
    <main
      className="min-h-screen px-5 py-8 text-[#1f2937] sm:px-8 lg:px-12"
      style={{ background: 'linear-gradient(135deg, #f7f2e9 0%, #fbf7f0 48%, #efe7db 100%)' }}
    >
      <div className="pointer-events-none fixed -left-[12%] top-[-10%] h-[48vh] w-[42vw] rounded-full bg-[#c57b3f]/20 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-[-12%] right-[-10%] h-[40vh] w-[36vw] rounded-full bg-[#2f6b4f]/15 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl">
        <Link href="/projects" className="inline-flex items-center gap-2 text-sm font-semibold text-[#7b746b] hover:text-[#9a5b2b]">
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>

        {loading || !project ? (
          <div className="mt-10 flex min-h-96 items-center justify-center rounded-[32px] border border-[#e7dece] bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin text-[#9a5b2b]" />
          </div>
        ) : (
          <>
            <header className="mt-8 rounded-[36px] border border-[#e7dece] bg-white/80 p-7 shadow-[0_20px_54px_rgba(83,67,48,0.1)] backdrop-blur">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#f3ede2] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#7b5a3c]">
                      {statusLabel(project.status)}
                    </span>
                    {role && (
                      <span className="rounded-full bg-[#eef5f0] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#2f6b4f]">
                        {role}
                      </span>
                    )}
                  </div>
                  <h1 className="mt-5 text-4xl font-light tracking-tight sm:text-6xl" style={{ fontFamily: 'Newsreader, Georgia, serif' }}>
                    {project.title}
                  </h1>
                  <p className="mt-4 text-base leading-7 text-[#6b5f52]">
                    {project.description || project.goal_summary || 'This project does not have a brief yet.'}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <button
                    type="button"
                    onClick={() => setSimulationOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d8c5aa] bg-white px-5 py-3 text-sm font-bold text-[#6b4a30] shadow-sm transition hover:border-[#9a5b2b]"
                  >
                    <Telescope className="h-4 w-4" />
                    Simulate goal
                  </button>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={openNewTask}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#9a5b2b] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#854d24]"
                    >
                      <Plus className="h-4 w-4" />
                      New task
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-7 grid gap-3 border-t border-[#eadfcd] pt-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-[#fbf7f0] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#8a7f72]">Tasks</p>
                  <p className="mt-2 text-2xl font-semibold">{tasks.length}</p>
                </div>
                <div className="rounded-2xl bg-[#fbf7f0] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#8a7f72]">Done</p>
                  <p className="mt-2 text-2xl font-semibold">{doneCount}</p>
                </div>
                <div className="rounded-2xl bg-[#fbf7f0] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#8a7f72]">Blocked</p>
                  <p className="mt-2 text-2xl font-semibold">{blockedCount}</p>
                </div>
                <div className="rounded-2xl bg-[#fbf7f0] p-4">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8a7f72]">
                    <CalendarDays className="h-4 w-4" />
                    Deadline
                  </p>
                  <p className="mt-2 text-sm font-semibold">{formatDate(project.target_deadline)}</p>
                </div>
              </div>
            </header>

            <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-6">
                <div id="recovery-planner">
                  <RecoveryFlow projectId={projectId} initialPlans={recoveryPlans} canWrite={canWrite} />
                </div>
                <MomentumFlowPanel projectId={projectId} projectTitle={project.title} compact />
                <MomentumMemoryPanel projectId={projectId} canWrite={canWrite} refreshKey={memoryRefreshKey} />
                <WorkBreakdownPanel projectId={projectId} projectTitle={project.title} canWrite={canWrite} onTasksCreated={refresh} />
                <TaskExtractionPanel projectId={projectId} canWrite={canWrite} onTasksCreated={refresh} />
                <TaskList tasks={tasks} canWrite={canWrite} onEdit={openEditTask} />
              </div>

              <aside className="h-fit rounded-[28px] border border-[#e7dece] bg-white/75 p-5 shadow-[0_16px_40px_rgba(83,67,48,0.07)]">
                <div className="flex items-center gap-2 text-sm font-bold text-[#1f2937]">
                  <Users className="h-4 w-4 text-[#9a5b2b]" />
                  Members
                </div>
                <div className="mt-4 space-y-3">
                  {project.members.map((member) => (
                    <div key={member.id} className="rounded-2xl bg-[#fbf7f0] p-3">
                      <p className="truncate text-sm font-semibold text-[#1f2937]">
                        {member.profile?.full_name || member.profile?.email || member.user_id}
                      </p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[#8a7f72]">{member.role}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </section>
          </>
        )}
      </div>

      <TaskDrawer
        open={drawerOpen}
        projectId={projectId}
        task={editingTask}
        members={project?.members ?? []}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleTaskSaved}
      />
      {project && (
        <SimulationModal
          open={simulationOpen}
          projectId={projectId}
          projectTitle={project.title}
          targetDeadline={project.target_deadline}
          tasks={tasks}
          onClose={() => setSimulationOpen(false)}
        />
      )}
    </main>
  )
}
