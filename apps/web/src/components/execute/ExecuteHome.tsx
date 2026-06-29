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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="fluent-kicker">Portfolio dashboard</p><h1 className="mt-1 text-2xl font-semibold">Good work starts with a clear plan</h1><p className="mt-1 text-sm text-[#616161]">{brief?.welcome || plan.brief.narrative}</p></div><div className="flex gap-2"><Link href="/planner" className="fluent-button-secondary">My work</Link><Link href="/projects" className="fluent-button"><FolderKanban className="h-4 w-4" /> View projects</Link></div></div>
    {error && <div className="mt-4 flex items-center justify-between rounded border border-[#f1bbbc] bg-[#fdf3f4] p-3 text-[#a4262c]"><span>{error}</span><button onClick={() => void load()} className="fluent-button-secondary"><RefreshCw className="h-4 w-4" /> Retry</button></div>}
    {loading ? <div className="mt-5 flex h-96 items-center justify-center fluent-card"><Loader2 className="h-5 w-5 animate-spin text-[#0f6cbd]" /></div> : <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label,value,suffix,Icon]) => <section key={label} className="fluent-card p-4"><div className="flex items-center justify-between text-[#616161]"><span className="text-xs font-semibold">{label}</span><Icon className="h-4 w-4" /></div><p className="mt-3 text-2xl font-semibold">{value} <span className="text-xs font-normal text-[#616161]">{suffix}</span></p></section>)}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
        <section className="fluent-card overflow-hidden"><header className="flex items-center justify-between border-b border-[#e0e0e0] px-4 py-3"><div><h2 className="font-semibold">Projects overview</h2><p className="text-xs text-[#616161]">Current portfolio health</p></div><Link href="/projects" className="text-sm font-semibold text-[#0f6cbd]">All projects</Link></header>
          {plan.projects.length === 0 ? <div className="p-10 text-center text-[#616161]">No active projects yet.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead><tr className="h-9 bg-[#fafafa] text-left text-xs text-[#616161]"><th className="px-4">Project</th><th>Open work</th><th>Blocked</th><th>Overdue</th><th>Status</th></tr></thead><tbody>{plan.projects.map((project) => <tr key={project.id} className="h-12 border-t border-[#ededed]"><td className="px-4"><Link className="font-semibold text-[#0f6cbd]" href={`/projects/${project.id}`}>{project.title}</Link></td><td>{project.open_tasks}</td><td>{project.blocked_tasks}</td><td>{project.overdue_tasks}</td><td><span className={project.blocked_tasks || project.overdue_tasks ? 'text-[#c50f1f]' : 'text-[#107c10]'}>{project.blocked_tasks || project.overdue_tasks ? 'At risk' : 'On track'}</span></td></tr>)}</tbody></table></div>}
        </section>
        <section className="fluent-card overflow-hidden"><header className="border-b border-[#e0e0e0] px-4 py-3"><h2 className="font-semibold">Needs attention</h2><p className="text-xs text-[#616161]">Priority work across your portfolio</p></header><div className="divide-y divide-[#ededed]">{attention.length ? attention.map((task) => <Link key={task.id} href={`/projects/${task.project_id}`} className="flex items-center gap-3 p-3 hover:bg-[#f7f9fb]"><span className={`h-2 w-2 rounded-full ${task.status === 'blocked' ? 'bg-[#c50f1f]' : 'bg-[#f7630c]'}`} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{task.title}</p><p className="truncate text-xs text-[#616161]">{task.project_title}</p></div><ArrowRight className="h-4 w-4 text-[#616161]" /></Link>) : <p className="p-8 text-center text-sm text-[#616161]">Nothing needs attention.</p>}</div></section>
      </div>
    </>}
  </main></AppShell>
}
