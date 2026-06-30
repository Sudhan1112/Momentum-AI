'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FolderKanban, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AppShell } from '@/components/shell/AppShell'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import type { MomentumDailyBrief } from '@/lib/momentum/ai/capabilities/morning-brief'
import type { WorkspaceExecutionScore } from '@/lib/momentum/execution-score'
import type { WorkspaceHealthSnapshot } from '@/lib/momentum/health-snapshot'
import type { PlannerToday } from '@/lib/momentum/planner/planner-service'

type Intelligence = { execution_score: WorkspaceExecutionScore; health: WorkspaceHealthSnapshot }
const EMPTY: PlannerToday = { generated_at:new Date(0).toISOString(), next_action:null, sections:{overdue:[],due_today:[],in_progress:[],blocked:[]}, projects:[], brief:{headline:'Set up your workspace',narrative:'Create a project and add tasks to begin.',metrics:{open_tasks:0,due_today:0,overdue:0,blocked:0,completed:0,active_projects:0}} }

export function ExecuteHome() {
  const [plan,setPlan] = useState(EMPTY)
  const [intel,setIntel] = useState<Intelligence|null>(null)
  const [brief,setBrief] = useState<MomentumDailyBrief|null>(null)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState<string|null>(null)
  async function load() {
    setLoading(true); setError(null)
    try {
      const [p,s,b] = await Promise.all([fetch('/api/planner/today',{cache:'no-store'}),fetch('/api/momentum/execution-score',{cache:'no-store'}),fetch('/api/momentum/brief',{cache:'no-store'})])
      const pp = await readResponsePayload<PlannerToday|{error:string}>(p); const sp = await readResponsePayload<Intelligence|{error:string}>(s); const bp = await readResponsePayload<MomentumDailyBrief|{error:string}>(b)
      if(!p.ok) throw new Error(getResponseErrorMessage(pp,'Could not load portfolio'))
      if(!s.ok) throw new Error(getResponseErrorMessage(sp,'Could not load intelligence'))
      setPlan(pp as PlannerToday); setIntel(sp as Intelligence); setBrief(b.ok ? bp as MomentumDailyBrief : null)
    } catch(e) { setError(e instanceof Error ? e.message : 'Could not load portfolio') } finally { setLoading(false) }
  }
  useEffect(() => { void load() },[])
  const metrics = plan.brief.metrics
  const attention = [...plan.sections.overdue,...plan.sections.blocked,...plan.sections.due_today].slice(0,6)
  const cards: Array<[string, number, string, LucideIcon]> = [
    ['Execution score',intel?.execution_score.score ?? 0,'/ 100',Sparkles],
    ['Active projects',metrics.active_projects,'',FolderKanban],
    ['Open tasks',metrics.open_tasks,'',Clock3],
    ['Completed',metrics.completed,'',CheckCircle2],
    ['Needs attention',metrics.overdue + metrics.blocked,'',AlertTriangle],
  ]
  return <AppShell><main className="fluent-page pb-24">
    <section className="workspace-hero flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="space-y-2">
        <p className="fluent-kicker">Portfolio dashboard</p>
        <div className="space-y-2">
          <h1 className="max-w-3xl text-[32px] font-semibold tracking-[-0.035em] text-[#101828] sm:text-[38px]">Good work starts with a clear plan</h1>
          <p className="max-w-3xl text-sm leading-6 text-[#667085]">{brief?.welcome || plan.brief.narrative}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/planner" className="fluent-button-secondary">My work</Link>
        <Link href="/projects" className="fluent-button"><FolderKanban className="h-4 w-4" /> View projects</Link>
      </div>
    </section>
    {error && <div className="fluent-panel flex items-center justify-between gap-3 border-[#f1bbbc] bg-[#fdf3f4] px-4 py-3 text-[#a4262c]"><span className="text-sm">{error}</span><button onClick={() => void load()} className="fluent-button-secondary"><RefreshCw className="h-4 w-4" /> Retry</button></div>}
    {loading ? <div className="fluent-panel flex h-96 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#0f6cbd]" /></div> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label,value,suffix,Icon]) => <section key={label} className="workspace-stat">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">{label}</p>
              <p className="mt-3 text-[30px] font-semibold tracking-tight text-[#101828]">{value}<span className="ml-1 text-xs font-medium text-[#98a2b3]">{suffix}</span></p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf4ff] text-[#0f6cbd]">
              <Icon className="h-4 w-4" />
            </div>
          </div>
        </section>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section className="fluent-panel overflow-hidden">
          <header className="fluent-section-header">
            <div>
              <h2 className="fluent-section-title">Projects overview</h2>
              <p className="fluent-section-copy">Current portfolio health</p>
            </div>
            <Link href="/projects" className="text-sm font-semibold text-[#0f6cbd]">All projects</Link>
          </header>
          {plan.projects.length === 0 ? <div className="p-6"><div className="fluent-empty">No active projects yet. Create a project to start tracking work across the portfolio.</div></div> : <div className="fluent-table-wrap"><table className="fluent-table min-w-[640px]"><thead><tr><th>Project</th><th>Open work</th><th>Blocked</th><th>Overdue</th><th>Status</th></tr></thead><tbody>{plan.projects.map((project) => <tr key={project.id}><td><Link className="font-semibold text-[#0f6cbd]" href={`/projects/${project.id}`}>{project.title}</Link></td><td>{project.open_tasks}</td><td>{project.blocked_tasks}</td><td>{project.overdue_tasks}</td><td><span className={project.blocked_tasks || project.overdue_tasks ? 'fluent-badge-red' : 'fluent-badge-green'}>{project.blocked_tasks || project.overdue_tasks ? 'At risk' : 'On track'}</span></td></tr>)}</tbody></table></div>}
        </section>
        <section className="fluent-panel overflow-hidden">
          <header className="fluent-section-header">
            <div>
              <h2 className="fluent-section-title">Needs attention</h2>
              <p className="fluent-section-copy">Priority work across your portfolio</p>
            </div>
          </header>
          <div className="divide-y divide-[#eef2f6]">
            {attention.length ? attention.map((task) => <Link key={task.id} href={`/projects/${task.project_id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-[#f8fbff]">
              <span className={`h-2.5 w-2.5 rounded-full ${task.status === 'blocked' ? 'bg-[#c50f1f]' : 'bg-[#f7630c]'}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#101828]">{task.title}</p>
                <p className="mt-0.5 truncate text-xs text-[#667085]">{task.project_title}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#98a2b3]" />
            </Link>) : <div className="p-6"><div className="fluent-empty">Nothing needs attention right now.</div></div>}
          </div>
        </section>
      </div>
    </>}
  </main></AppShell>
}
