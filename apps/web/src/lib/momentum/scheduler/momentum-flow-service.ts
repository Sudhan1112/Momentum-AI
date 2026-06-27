import 'server-only'

import { executeAiTextCapability, type AiExecutionContext, type AiFallbackReason } from '@/lib/momentum/ai/executor'
import { intentionallyCitationless, withCitations } from '@/lib/momentum/ai/gateway'
import type { AiCitationInput } from '@/lib/momentum/ai/run-logger'
import { calculateExecutionScore } from '@/lib/momentum/execution-score'
import { calculateWorkspaceHealth } from '@/lib/momentum/health-snapshot'
import { badRequest, notFound } from '@/lib/momentum/errors'
import { listProjectsForUser } from '@/lib/momentum/projects/project-service'
import { listRecoveryPlans } from '@/lib/momentum/recovery-service'
import { scoreTaskRisk } from '@/lib/momentum/risk-scorer'
import { listProjectTasks } from '@/lib/momentum/tasks/task-service'
import { validateOptionalUuid, validateRequiredUuid } from '@/lib/momentum/validation/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProjectListItem } from '@/types/project'
import type { TaskItem, TaskPriority } from '@/types/task'
import {
  addCalendarDays,
  calendarDayDifference,
  parseDateOnly,
  timestampMs,
  todayDateOnly,
  toDateOnly,
  validatePlanningDate,
} from '@/lib/momentum/date'

export type MomentumFlowProposalStatus = 'proposed' | 'applied' | 'dismissed' | 'expired'
export type MomentumFlowSessionStatus = 'proposed' | 'scheduled' | 'locked' | 'completed' | 'skipped'
export type FocusSessionType = 'deep_work' | 'quick_win' | 'admin' | 'learning' | 'meeting' | 'break'
export type EnergyRequirement = 'high' | 'medium' | 'low'

export type CapacitySummary = {
  schedule_date: string
  horizon_days: number
  default_minutes: number
  learned_minutes: number | null
  productive_minutes: number
  locked_minutes: number
  scheduled_minutes: number
  break_minutes: number
  confidence: number
  working_window: {
    start_hour: number
    end_hour: number
    lunch_start_hour: number
    lunch_end_hour: number
  }
}

export type MomentumFlowInsights = {
  total_focus_minutes: number
  deep_work_percentage: number
  context_switches: number
  break_minutes: number
  risk_weighted_minutes: number
  unscheduled_minutes: number
}

export type BacklogRemainingItem = {
  task_id: string
  project_id: string
  project_title: string
  title: string
  remaining_minutes: number
  risk_level: string
  reason: string
}

export type BacklogRemaining = {
  total_minutes: number
  task_count: number
  high_risk_task_count: number
  items: BacklogRemainingItem[]
}

export type MomentumFlowSession = {
  id: string
  proposal_id: string | null
  user_id: string
  project_id: string | null
  task_id: string | null
  title: string
  project_title?: string | null
  start_at: string
  end_at: string
  duration_minutes: number
  session_type: FocusSessionType
  energy_requirement: EnergyRequirement
  status: MomentumFlowSessionStatus
  score: number
  rationale: string
  is_manual_override: boolean
  is_locked: boolean
  source: string
  external_event_id: string | null
  calendar_provider: string | null
  calendar_status: string | null
  created_at: string
  updated_at: string
}

export type MomentumFlowProposal = {
  id: string
  user_id: string
  project_id: string | null
  ai_run_id: string | null
  schedule_date: string
  horizon_days: number
  version: number
  status: MomentumFlowProposalStatus
  input_snapshot: Record<string, unknown>
  capacity_summary: CapacitySummary
  confidence: number
  insights: MomentumFlowInsights
  backlog_remaining: BacklogRemaining
  explanation_summary: string | null
  applied_at: string | null
  created_at: string
  updated_at: string
  sessions: MomentumFlowSession[]
}

export type MomentumFlowToday = {
  schedule_date: string
  applied_sessions: MomentumFlowSession[]
  active_proposal: MomentumFlowProposal | null
  capacity_summary: CapacitySummary
  backlog_remaining: BacklogRemaining
}

export type GenerateMomentumFlowInput = {
  projectId?: string | null
  scheduleDate?: string | null
  horizonDays?: number | null
}

export type ApplyMomentumFlowInput = {
  sessionIds?: string[]
}

export type UpdateMomentumFlowSessionInput = {
  startAt?: string | null
  endAt?: string | null
  status?: MomentumFlowSessionStatus | null
  isLocked?: boolean | null
}

export type MomentumFlowExplanation = {
  explanation: string
  ai_run_id: string | null
  mode: 'ai' | 'fallback'
  fallback_reason: AiFallbackReason | null
}

type ProposalRow = Omit<MomentumFlowProposal, 'sessions' | 'capacity_summary' | 'insights' | 'backlog_remaining'> & {
  capacity_summary: CapacitySummary
  insights: MomentumFlowInsights
  backlog_remaining: BacklogRemaining
}

type SessionRow = MomentumFlowSession

type CapacityProfileRow = {
  id: string
  user_id: string
  weekday: number
  default_minutes: number
  learned_minutes: number | null
  confidence: number
  sample_count: number
}

type ProjectEntry = {
  project: ProjectListItem
  tasks: TaskItem[]
  recoveryTaskIds: Set<string>
  simulationPressure: number
}

type CandidateTask = {
  task: TaskItem
  project: ProjectListItem
  score: number
  riskScore: ReturnType<typeof scoreTaskRisk>
  sessionType: FocusSessionType
  energy: EnergyRequirement
  estimateMinutes: number
  rationale: string
}

type Slot = {
  start: Date
  end: Date
}

type DraftSession = Omit<
  MomentumFlowSession,
  'id' | 'proposal_id' | 'created_at' | 'updated_at' | 'project_title'
> & {
  project_title?: string | null
}

const DEFAULT_PRODUCTIVE_MINUTES = 240
const MIN_BLOCK_MINUTES = 30
const MAX_BLOCK_MINUTES = 90
const BREAK_MINUTES = 15
const OPEN_STATUSES = new Set(['backlog', 'todo', 'in_progress', 'blocked'])

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 30,
  high: 22,
  medium: 14,
  low: 8,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function dateOnly(date: Date) {
  return toDateOnly(date)!
}

function parseScheduleDate(value?: string | null) {
  if (!value) return todayDateOnly()
  const result = validatePlanningDate(value, { field: 'schedule_date' })
  if (!result.ok) throw badRequest(result.message)
  return dateOnly(result.value)
}

function normalizeHorizon(value?: number | null) {
  if (value == null) return 1
  if (!Number.isInteger(value)) throw badRequest('horizon_days must be an integer')
  return clamp(value, 1, 7)
}

function startOfScheduleDate(date: string) {
  return parseDateOnly(date) ?? new Date()
}

function addDays(date: Date, days: number) {
  return addCalendarDays(date, days) ?? date
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000)
}

function durationMinutes(start: string | Date, end: string | Date) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000))
}

function isOpenTask(task: TaskItem) {
  return OPEN_STATUSES.has(task.status)
}

function estimateMinutes(task: TaskItem) {
  return task.estimate_minutes ?? 120
}

function dueDatePressure(task: TaskItem, scheduleDate: string) {
  if (!task.due_at) return 3
  const days = calendarDayDifference(scheduleDate, task.due_at)
  if (days == null) return 3
  if (days < 0) return 30
  if (days === 0) return 26
  if (days <= 2) return 22
  if (days <= 7) return 14
  return 5
}

function inferSessionType(task: TaskItem, riskLevel: string): FocusSessionType {
  const text = `${task.title} ${task.description ?? ''}`.toLowerCase()
  if (task.status === 'blocked') return 'admin'
  if (/\b(meet|meeting|call|sync|mentor|interview)\b/.test(text)) return 'meeting'
  if (/\b(learn|research|study|read|explore)\b/.test(text)) return 'learning'
  if ((task.estimate_minutes ?? 120) <= 45) return 'quick_win'
  if (task.priority === 'urgent' || task.priority === 'high' || riskLevel === 'critical' || riskLevel === 'high') return 'deep_work'
  return 'admin'
}

function energyFor(sessionType: FocusSessionType, task: TaskItem, riskLevel: string): EnergyRequirement {
  if (sessionType === 'deep_work') return 'high'
  if (sessionType === 'learning') return 'medium'
  if (sessionType === 'quick_win' || sessionType === 'admin' || sessionType === 'meeting' || sessionType === 'break') return 'low'
  if (task.priority === 'urgent' || riskLevel === 'critical') return 'high'
  return 'medium'
}

function scoreCandidate(
  task: TaskItem,
  projectTasks: TaskItem[],
  projectScore: number,
  recoveryTaskIds: Set<string>,
  simulationPressure: number,
  scheduleDate: string
) {
  const risk = scoreTaskRisk(task, projectTasks, new Date(`${scheduleDate}T09:00:00`))
  const priority = PRIORITY_WEIGHT[task.priority]
  const due = dueDatePressure(task, scheduleDate)
  const riskWeight = Math.round(risk.score_100 * 0.35)
  const projectPressure = projectScore < 45 ? 12 : projectScore < 70 ? 7 : 0
  const recovery = recoveryTaskIds.has(task.id) ? 10 : 0
  const progress = task.status === 'in_progress' ? 8 : 0
  const estimate = task.estimate_minutes ? 5 : 0
  const blocked = task.status === 'blocked' ? 8 : 0
  return {
    risk,
    score: clamp(priority + due + riskWeight + projectPressure + recovery + simulationPressure + progress + estimate + blocked, 0, 100),
  }
}

function candidateRationale(candidate: Omit<CandidateTask, 'rationale'>) {
  const reasons = [
    `${candidate.task.priority} priority`,
    `${candidate.riskScore.level} risk`,
    candidate.task.due_at ? `due ${toDateOnly(candidate.task.due_at) ?? 'invalid date'}` : 'no due date',
  ]
  if (candidate.task.status === 'blocked') reasons.push('blocked work needs an unblock session')
  return `Scheduled because ${reasons.join(', ')}.`
}

async function projectEntries(userId: string, projectId: string | null, scheduleDate: string): Promise<ProjectEntry[]> {
  const projects = projectId ? (await listProjectsForUser(userId)).filter((project) => project.id === projectId) : await listProjectsForUser(userId)
  if (projectId && projects.length === 0) throw notFound('Project not found')

  return Promise.all(
    projects
      .filter((project) => project.status === 'active' || project.id === projectId)
      .map(async (project) => {
        const [tasks, recoveryPlans, simulationPressure] = await Promise.all([
          listProjectTasks(project.id),
          listRecoveryPlans(project.id).catch(() => []),
          latestSimulationPressure(project.id),
        ])
        const recoveryTaskIds = new Set(
          recoveryPlans
            .filter((plan) => plan.status === 'proposed')
            .flatMap((plan) => plan.actions.map((action) => action.task_id))
        )
        void scheduleDate
        return { project, tasks, recoveryTaskIds, simulationPressure }
      })
  )
}

async function latestSimulationPressure(projectId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('goal_simulations')
    .select('projected_state')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return 0
  const probability = Number((data.projected_state as { success_probability?: unknown } | null)?.success_probability)
  if (!Number.isFinite(probability)) return 0
  if (probability < 45) return 12
  if (probability < 65) return 8
  return 0
}

function buildCandidates(entries: ProjectEntry[], scheduleDate: string) {
  const candidates: CandidateTask[] = []
  for (const entry of entries) {
    const score = calculateExecutionScore(entry.tasks, { scope: 'project', projectId: entry.project.id, now: new Date(`${scheduleDate}T09:00:00`) })
    const health = calculateWorkspaceHealth(score)
    void health

    for (const task of entry.tasks.filter(isOpenTask)) {
      const scored = scoreCandidate(task, entry.tasks, score.score, entry.recoveryTaskIds, entry.simulationPressure, scheduleDate)
      const sessionType = inferSessionType(task, scored.risk.level)
      const energy = energyFor(sessionType, task, scored.risk.level)
      const candidate = {
        task,
        project: entry.project,
        score: scored.score,
        riskScore: scored.risk,
        sessionType,
        energy,
        estimateMinutes: task.status === 'blocked' ? 30 : estimateMinutes(task),
      }
      candidates.push({ ...candidate, rationale: candidateRationale(candidate) })
    }
  }

  return candidates.sort((a, b) => b.score - a.score || timestampMs(a.task.due_at) - timestampMs(b.task.due_at))
}

async function capacityProfile(userId: string, scheduleDate: string): Promise<CapacityProfileRow> {
  const weekday = startOfScheduleDate(scheduleDate).getDay()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_capacity_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('weekday', weekday)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (data) return data as CapacityProfileRow

  const { data: inserted, error: insertError } = await admin
    .from('user_capacity_profiles')
    .insert({ user_id: userId, weekday, default_minutes: DEFAULT_PRODUCTIVE_MINUTES })
    .select('*')
    .single()

  if (insertError) throw new Error(insertError.message)
  return inserted as CapacityProfileRow
}

function productiveMinutes(profile: CapacityProfileRow) {
  if (profile.learned_minutes == null || profile.sample_count < 3 || profile.confidence < 40) {
    return profile.default_minutes
  }
  const confidence = profile.confidence / 100
  return Math.round(profile.default_minutes * (1 - confidence) + profile.learned_minutes * confidence)
}

function workSlots(scheduleDate: string, horizonDays: number): Slot[] {
  const slots: Slot[] = []
  const base = startOfScheduleDate(scheduleDate)
  for (let day = 0; day < horizonDays; day += 1) {
    const current = addDays(base, day)
    const dayString = dateOnly(current)
    slots.push({ start: new Date(`${dayString}T09:00:00`), end: new Date(`${dayString}T12:00:00`) })
    slots.push({ start: new Date(`${dayString}T13:00:00`), end: new Date(`${dayString}T17:00:00`) })
  }
  return slots
}

function subtractBusy(slots: Slot[], busy: Array<{ start_at: string; end_at: string }>) {
  let available = [...slots]
  for (const block of busy) {
    const busyStart = new Date(block.start_at)
    const busyEnd = new Date(block.end_at)
    const next: Slot[] = []
    for (const slot of available) {
      if (busyEnd <= slot.start || busyStart >= slot.end) {
        next.push(slot)
        continue
      }
      if (busyStart > slot.start) next.push({ start: slot.start, end: busyStart })
      if (busyEnd < slot.end) next.push({ start: busyEnd, end: slot.end })
    }
    available = next.filter((slot) => durationMinutes(slot.start, slot.end) >= MIN_BLOCK_MINUTES)
  }
  return available
}

function sortSlotsForEnergy(slots: Slot[], energy: EnergyRequirement) {
  return [...slots].sort((a, b) => {
    const hourA = a.start.getHours()
    const hourB = b.start.getHours()
    const score = (hour: number) => {
      if (energy === 'high') return hour < 12 ? 0 : hour < 15 ? 1 : 2
      if (energy === 'medium') return hour >= 13 && hour < 16 ? 0 : hour < 12 ? 1 : 2
      return hour >= 14 ? 0 : 1
    }
    return score(hourA) - score(hourB) || a.start.getTime() - b.start.getTime()
  })
}

function placeSession(slots: Slot[], duration: number, energy: EnergyRequirement) {
  const ordered = sortSlotsForEnergy(slots, energy)
  const slot = ordered.find((candidate) => durationMinutes(candidate.start, candidate.end) >= duration)
  if (!slot) return null
  const start = slot.start
  const end = addMinutes(start, duration)
  return {
    start,
    end,
    slots: subtractBusy(slots, [{ start_at: start.toISOString(), end_at: end.toISOString() }]),
  }
}

async function appliedBlockingSessions(userId: string, scheduleDate: string, horizonDays: number, projectId: string | null) {
  const start = startOfScheduleDate(scheduleDate)
  const end = addDays(start, horizonDays)
  const admin = createAdminClient()
  let query = admin
    .from('momentum_flow_sessions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['scheduled', 'locked'])
    .gte('start_at', start.toISOString())
    .lt('start_at', end.toISOString())

  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query.order('start_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as SessionRow[]
}

function draftBreak(userId: string, placement: { start: Date; end: Date }): DraftSession {
  return {
    user_id: userId,
    project_id: null,
    task_id: null,
    title: 'Reset break',
    start_at: placement.start.toISOString(),
    end_at: placement.end.toISOString(),
    duration_minutes: BREAK_MINUTES,
    session_type: 'break',
    energy_requirement: 'low',
    status: 'proposed',
    score: 0,
    rationale: 'Short buffer to keep the flow sustainable.',
    is_manual_override: false,
    is_locked: false,
    source: 'deterministic',
    external_event_id: null,
    calendar_provider: null,
    calendar_status: null,
  }
}

function draftWorkSession(userId: string, candidate: CandidateTask, duration: number, placement: { start: Date; end: Date }): DraftSession {
  return {
    user_id: userId,
    project_id: candidate.project.id,
    project_title: candidate.project.title,
    task_id: candidate.task.id,
    title: candidate.task.status === 'blocked' ? `Unblock: ${candidate.task.title}` : candidate.task.title,
    start_at: placement.start.toISOString(),
    end_at: placement.end.toISOString(),
    duration_minutes: duration,
    session_type: candidate.sessionType,
    energy_requirement: candidate.energy,
    status: 'proposed',
    score: candidate.score,
    rationale: candidate.rationale,
    is_manual_override: false,
    is_locked: false,
    source: 'deterministic',
    external_event_id: null,
    calendar_provider: null,
    calendar_status: null,
  }
}

function scheduleCandidates(userId: string, candidates: CandidateTask[], slots: Slot[], productiveLimit: number) {
  let availableSlots = slots
  let focusMinutes = 0
  let workSessionsSinceBreak = 0
  const sessions: DraftSession[] = []
  const remaining = new Map<string, BacklogRemainingItem>()

  for (const candidate of candidates) {
    let remainingMinutes = candidate.estimateMinutes
    let scheduledAny = false

    while (remainingMinutes > 0 && focusMinutes < productiveLimit) {
      if (workSessionsSinceBreak >= 2) {
        const breakPlacement = placeSession(availableSlots, BREAK_MINUTES, 'low')
        if (breakPlacement) {
          sessions.push(draftBreak(userId, breakPlacement))
          availableSlots = breakPlacement.slots
        }
        workSessionsSinceBreak = 0
      }

      const duration = Math.min(MAX_BLOCK_MINUTES, Math.max(MIN_BLOCK_MINUTES, remainingMinutes), productiveLimit - focusMinutes)
      if (duration < MIN_BLOCK_MINUTES) break
      const placement = placeSession(availableSlots, duration, candidate.energy)
      if (!placement) break

      sessions.push(draftWorkSession(userId, candidate, duration, placement))
      availableSlots = placement.slots
      focusMinutes += duration
      remainingMinutes -= duration
      workSessionsSinceBreak += 1
      scheduledAny = true
    }

    if (remainingMinutes > 0 || !scheduledAny) {
      remaining.set(candidate.task.id, {
        task_id: candidate.task.id,
        project_id: candidate.project.id,
        project_title: candidate.project.title,
        title: candidate.task.title,
        remaining_minutes: Math.max(remainingMinutes, candidate.estimateMinutes),
        risk_level: candidate.riskScore.level,
        reason: focusMinutes >= productiveLimit ? 'Capacity is full.' : 'No viable time block was available.',
      })
    }
  }

  return {
    sessions: sessions.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    backlogItems: Array.from(remaining.values()),
    focusMinutes,
  }
}

function contextSwitches(sessions: DraftSession[] | MomentumFlowSession[]) {
  const work = sessions.filter((session) => session.project_id && session.session_type !== 'break')
  let switches = 0
  for (let index = 1; index < work.length; index += 1) {
    if (work[index].project_id !== work[index - 1].project_id) switches += 1
  }
  return switches
}

function buildInsights(sessions: Array<DraftSession | MomentumFlowSession>, backlog: BacklogRemaining): MomentumFlowInsights {
  const focus = sessions.filter((session) => session.session_type !== 'break')
  const totalFocus = focus.reduce((total, session) => total + session.duration_minutes, 0)
  const deepWork = focus.filter((session) => session.session_type === 'deep_work').reduce((total, session) => total + session.duration_minutes, 0)
  const breakMinutes = sessions.filter((session) => session.session_type === 'break').reduce((total, session) => total + session.duration_minutes, 0)
  const riskWeighted = focus.reduce((total, session) => total + Math.round((session.duration_minutes * session.score) / 100), 0)

  return {
    total_focus_minutes: totalFocus,
    deep_work_percentage: totalFocus === 0 ? 0 : Math.round((deepWork / totalFocus) * 100),
    context_switches: contextSwitches(sessions as MomentumFlowSession[]),
    break_minutes: breakMinutes,
    risk_weighted_minutes: riskWeighted,
    unscheduled_minutes: backlog.total_minutes,
  }
}

function buildBacklog(items: BacklogRemainingItem[]): BacklogRemaining {
  return {
    total_minutes: items.reduce((total, item) => total + item.remaining_minutes, 0),
    task_count: items.length,
    high_risk_task_count: items.filter((item) => item.risk_level === 'critical' || item.risk_level === 'high').length,
    items: items.sort((a, b) => b.remaining_minutes - a.remaining_minutes).slice(0, 8),
  }
}

function schedulingConfidence(candidates: CandidateTask[], capacityConfidence: number, backlog: BacklogRemaining) {
  if (candidates.length === 0) return 100
  const estimateCoverage = candidates.filter((candidate) => Boolean(candidate.task.estimate_minutes)).length / candidates.length
  const dueCoverage = candidates.filter((candidate) => Boolean(candidate.task.due_at)).length / candidates.length
  const backlogPenalty = Math.min(30, backlog.total_minutes / 20)
  return Math.round(clamp(35 * estimateCoverage + 20 * dueCoverage + 25 * (capacityConfidence / 100) + 20 - backlogPenalty, 20, 98))
}

function summaryFor(confidence: number, backlog: BacklogRemaining, sessions: DraftSession[]) {
  if (sessions.length === 0) return 'Momentum Flow could not find a viable schedule from the current task load.'
  if (backlog.total_minutes > 0) {
    return `Momentum Flow scheduled ${sessions.filter((session) => session.session_type !== 'break').length} focus sessions with ${confidence}% confidence and left ${Math.round(backlog.total_minutes / 60)}h of backlog remaining.`
  }
  return `Momentum Flow scheduled the available work with ${confidence}% confidence.`
}

async function nextVersion(userId: string, projectId: string | null, scheduleDate: string) {
  const admin = createAdminClient()
  let query = admin
    .from('momentum_flow_proposals')
    .select('version')
    .eq('user_id', userId)
    .eq('schedule_date', scheduleDate)
    .order('version', { ascending: false })
    .limit(1)

  query = projectId ? query.eq('project_id', projectId) : query.is('project_id', null)

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return ((data as { version?: number } | null)?.version ?? 0) + 1
}

function rowToSession(row: SessionRow, projectTitles = new Map<string, string>()): MomentumFlowSession {
  return {
    ...row,
    project_title: row.project_id ? projectTitles.get(row.project_id) ?? row.project_title ?? null : null,
  }
}

function rowToProposal(row: ProposalRow, sessions: MomentumFlowSession[]): MomentumFlowProposal {
  return {
    ...row,
    sessions,
  }
}

export async function generateMomentumFlowProposal(userId: string, input: GenerateMomentumFlowInput): Promise<MomentumFlowProposal> {
  validateRequiredUuid(userId, 'user_id')
  const projectId = validateOptionalUuid(input.projectId ?? null, 'project_id')
  const scheduleDate = parseScheduleDate(input.scheduleDate)
  const horizonDays = normalizeHorizon(input.horizonDays)
  const [entries, profile, blocking] = await Promise.all([
    projectEntries(userId, projectId, scheduleDate),
    capacityProfile(userId, scheduleDate),
    appliedBlockingSessions(userId, scheduleDate, horizonDays, projectId),
  ])
  const projectTitles = new Map(entries.map((entry) => [entry.project.id, entry.project.title]))
  const candidates = buildCandidates(entries, scheduleDate)
  const productive = productiveMinutes(profile) * horizonDays
  const lockedMinutes = blocking.reduce((total, session) => total + session.duration_minutes, 0)
  const slots = subtractBusy(workSlots(scheduleDate, horizonDays), blocking)
  const scheduled = scheduleCandidates(userId, candidates, slots, productive)
  const backlog = buildBacklog(scheduled.backlogItems)
  const confidence = schedulingConfidence(candidates, profile.confidence, backlog)
  const insights = buildInsights(scheduled.sessions, backlog)
  const capacity: CapacitySummary = {
    schedule_date: scheduleDate,
    horizon_days: horizonDays,
    default_minutes: profile.default_minutes * horizonDays,
    learned_minutes: profile.learned_minutes ? profile.learned_minutes * horizonDays : null,
    productive_minutes: productive,
    locked_minutes: lockedMinutes,
    scheduled_minutes: insights.total_focus_minutes,
    break_minutes: insights.break_minutes,
    confidence: profile.confidence,
    working_window: {
      start_hour: 9,
      end_hour: 17,
      lunch_start_hour: 12,
      lunch_end_hour: 13,
    },
  }
  const version = await nextVersion(userId, projectId, scheduleDate)
  const explanationSummary = summaryFor(confidence, backlog, scheduled.sessions)
  const admin = createAdminClient()
  const { data: proposal, error } = await admin
    .from('momentum_flow_proposals')
    .insert({
      user_id: userId,
      project_id: projectId,
      schedule_date: scheduleDate,
      horizon_days: horizonDays,
      version,
      input_snapshot: {
        project_id: projectId,
        candidate_count: candidates.length,
        locked_session_count: blocking.length,
      },
      capacity_summary: capacity,
      confidence,
      insights,
      backlog_remaining: backlog,
      explanation_summary: explanationSummary,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  const proposalRow = proposal as ProposalRow

  let sessions: MomentumFlowSession[] = []
  if (scheduled.sessions.length > 0) {
    const { data: insertedSessions, error: sessionError } = await admin
      .from('momentum_flow_sessions')
      .insert(
        scheduled.sessions.map((session) => ({
          ...session,
          proposal_id: proposalRow.id,
        }))
      )
      .select('*')
      .order('start_at', { ascending: true })

    if (sessionError) throw new Error(sessionError.message)
    sessions = ((insertedSessions ?? []) as SessionRow[]).map((session) => rowToSession(session, projectTitles))
  }

  return rowToProposal(proposalRow, sessions)
}

async function loadProposal(userId: string, proposalId: string) {
  validateRequiredUuid(proposalId, 'proposal_id')
  const admin = createAdminClient()
  const { data: proposal, error } = await admin
    .from('momentum_flow_proposals')
    .select('*')
    .eq('id', proposalId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!proposal) throw notFound('Momentum Flow proposal not found')

  const { data: sessions, error: sessionError } = await admin
    .from('momentum_flow_sessions')
    .select('*')
    .eq('proposal_id', proposalId)
    .eq('user_id', userId)
    .order('start_at', { ascending: true })

  if (sessionError) throw new Error(sessionError.message)
  return rowToProposal(proposal as ProposalRow, (sessions ?? []) as MomentumFlowSession[])
}

export async function applyMomentumFlowProposal(userId: string, proposalId: string, input: ApplyMomentumFlowInput = {}) {
  const proposal = await loadProposal(userId, proposalId)
  if (proposal.status !== 'proposed') throw badRequest('Only proposed Momentum Flow schedules can be applied')

  const selected = new Set(input.sessionIds?.length ? input.sessionIds : proposal.sessions.map((session) => session.id))
  const admin = createAdminClient()
  const selectedIds = proposal.sessions.filter((session) => selected.has(session.id)).map((session) => session.id)
  const skippedIds = proposal.sessions.filter((session) => !selected.has(session.id)).map((session) => session.id)

  if (selectedIds.length > 0) {
    const { error } = await admin.from('momentum_flow_sessions').update({ status: 'scheduled' }).in('id', selectedIds).eq('user_id', userId)
    if (error) throw new Error(error.message)
  }
  if (skippedIds.length > 0) {
    const { error } = await admin.from('momentum_flow_sessions').update({ status: 'skipped' }).in('id', skippedIds).eq('user_id', userId)
    if (error) throw new Error(error.message)
  }

  const { error: proposalError } = await admin
    .from('momentum_flow_proposals')
    .update({ status: 'applied', applied_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('user_id', userId)

  if (proposalError) throw new Error(proposalError.message)
  return loadProposal(userId, proposalId)
}

export async function listMomentumFlowToday(userId: string, projectIdInput?: string | null): Promise<MomentumFlowToday> {
  validateRequiredUuid(userId, 'user_id')
  const projectId = validateOptionalUuid(projectIdInput ?? null, 'project_id')
  const scheduleDate = todayDateOnly()
  const [profile, blocking, entries] = await Promise.all([
    capacityProfile(userId, scheduleDate),
    appliedBlockingSessions(userId, scheduleDate, 1, projectId),
    projectEntries(userId, projectId, scheduleDate).catch(() => []),
  ])
  const projectTitles = new Map(entries.map((entry) => [entry.project.id, entry.project.title]))
  const admin = createAdminClient()
  let proposalQuery = admin
    .from('momentum_flow_proposals')
    .select('*')
    .eq('user_id', userId)
    .eq('schedule_date', scheduleDate)
    .order('created_at', { ascending: false })
    .limit(1)
  proposalQuery = projectId ? proposalQuery.eq('project_id', projectId) : proposalQuery.is('project_id', null)
  const { data: proposal } = await proposalQuery.maybeSingle()

  const activeProposal = proposal ? await loadProposal(userId, (proposal as ProposalRow).id) : null
  const applied = blocking.map((session) => rowToSession(session, projectTitles))
  const focusMinutes = applied.filter((session) => session.session_type !== 'break').reduce((total, session) => total + session.duration_minutes, 0)
  const capacity: CapacitySummary = {
    schedule_date: scheduleDate,
    horizon_days: 1,
    default_minutes: profile.default_minutes,
    learned_minutes: profile.learned_minutes,
    productive_minutes: productiveMinutes(profile),
    locked_minutes: applied.filter((session) => session.is_locked || session.status === 'locked').reduce((total, session) => total + session.duration_minutes, 0),
    scheduled_minutes: focusMinutes,
    break_minutes: applied.filter((session) => session.session_type === 'break').reduce((total, session) => total + session.duration_minutes, 0),
    confidence: profile.confidence,
    working_window: {
      start_hour: 9,
      end_hour: 17,
      lunch_start_hour: 12,
      lunch_end_hour: 13,
    },
  }

  return {
    schedule_date: scheduleDate,
    applied_sessions: applied,
    active_proposal: activeProposal,
    capacity_summary: activeProposal?.capacity_summary ?? capacity,
    backlog_remaining: activeProposal?.backlog_remaining ?? buildBacklog([]),
  }
}

async function updateCapacityFromCompletedSession(userId: string, session: MomentumFlowSession) {
  const start = new Date(session.start_at)
  const weekday = start.getDay()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_capacity_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('weekday', weekday)
    .maybeSingle()
  if (error) throw new Error(error.message)

  const current = (data as CapacityProfileRow | null) ?? {
    id: '',
    user_id: userId,
    weekday,
    default_minutes: DEFAULT_PRODUCTIVE_MINUTES,
    learned_minutes: null,
    confidence: 0,
    sample_count: 0,
  }
  const sampleCount = current.sample_count + 1
  const learned = current.learned_minutes ?? current.default_minutes
  const learnedMinutes = Math.round((learned * current.sample_count + session.duration_minutes) / sampleCount)
  const confidence = clamp(20 + sampleCount * 10, 0, 90)

  const { error: upsertError } = await admin.from('user_capacity_profiles').upsert({
    user_id: userId,
    weekday,
    default_minutes: current.default_minutes,
    learned_minutes: learnedMinutes,
    confidence,
    sample_count: sampleCount,
  })

  if (upsertError) throw new Error(upsertError.message)
}

export async function updateMomentumFlowSession(userId: string, sessionId: string, input: UpdateMomentumFlowSessionInput) {
  validateRequiredUuid(sessionId, 'session_id')
  const admin = createAdminClient()
  const { data: existing, error } = await admin
    .from('momentum_flow_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!existing) throw notFound('Momentum Flow session not found')

  const payload: Record<string, unknown> = {}
  if (input.startAt && input.endAt) {
    const start = new Date(input.startAt)
    const end = new Date(input.endAt)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw badRequest('Session start_at and end_at must be valid')
    }
    payload.start_at = start.toISOString()
    payload.end_at = end.toISOString()
    payload.duration_minutes = durationMinutes(start, end)
    payload.is_manual_override = true
    payload.is_locked = true
    payload.status = 'locked'
  }
  if (input.status) {
    if (!['scheduled', 'locked', 'completed', 'skipped'].includes(input.status)) throw badRequest('Invalid session status')
    payload.status = input.status
    if (input.status === 'locked') payload.is_locked = true
  }
  if (input.isLocked != null) {
    payload.is_locked = input.isLocked
    if (input.isLocked) payload.status = 'locked'
  }
  if (Object.keys(payload).length === 0) throw badRequest('No session fields provided')

  const { data: updated, error: updateError } = await admin
    .from('momentum_flow_sessions')
    .update(payload)
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select('*')
    .single()
  if (updateError) throw new Error(updateError.message)

  const session = rowToSession(updated as SessionRow)
  if (session.status === 'completed' && session.session_type !== 'break') {
    await updateCapacityFromCompletedSession(userId, session)
  }
  return session
}

type ExplainDeterministic = MomentumFlowProposal
type ExplainContext = AiExecutionContext

async function buildExplainContext(proposal: ExplainDeterministic): Promise<ExplainContext> {
  const citations: AiCitationInput[] = proposal.sessions
    .filter((session) => session.task_id)
    .slice(0, 8)
    .map((session, index) => ({
      sourceType: 'task' as const,
      sourceId: session.task_id as string,
      excerpt: `${session.title}: ${session.rationale}`,
      metadata: { project_id: session.project_id, start_at: session.start_at, end_at: session.end_at },
      sortOrder: index,
    }))

  return {
    contextJson: JSON.stringify(
      {
        proposal: {
          schedule_date: proposal.schedule_date,
          version: proposal.version,
          status: proposal.status,
          confidence: proposal.confidence,
          capacity_summary: proposal.capacity_summary,
          insights: proposal.insights,
          backlog_remaining: proposal.backlog_remaining,
          sessions: proposal.sessions.map((session) => ({
            title: session.title,
            start_at: session.start_at,
            end_at: session.end_at,
            session_type: session.session_type,
            energy_requirement: session.energy_requirement,
            score: session.score,
            rationale: session.rationale,
          })),
        },
      },
      null,
      2
    ),
    inputSummary: `Explain Momentum Flow proposal ${proposal.id}.`,
    citations:
      citations.length > 0
        ? withCitations(citations)
        : intentionallyCitationless('Momentum Flow explanation has no task-backed sessions.'),
  }
}

export async function explainMomentumFlowProposal(userId: string, proposalId: string): Promise<MomentumFlowExplanation> {
  const proposal = await loadProposal(userId, proposalId)
  const result = await executeAiTextCapability<ExplainDeterministic, ExplainContext>({
    userId,
    projectId: proposal.project_id,
    capability: 'momentum_flow',
    buildDeterministic: () => proposal,
    buildContext: buildExplainContext,
    buildUserInstruction: () => 'Explain why this Momentum Flow proposal is ordered this way. Keep the answer concise and do not change metrics.',
    temperature: 0.35,
    maxOutputTokens: 450,
  })

  if (result.mode === 'fallback') {
    return {
      explanation: proposal.explanation_summary ?? 'Momentum Flow was generated deterministically from risk, due dates, priority, and available capacity.',
      ai_run_id: null,
      mode: 'fallback',
      fallback_reason: result.reason,
    }
  }

  const admin = createAdminClient()
  await admin.from('momentum_flow_proposals').update({ ai_run_id: result.run.id }).eq('id', proposal.id).eq('user_id', userId)
  return {
    explanation: result.text,
    ai_run_id: result.run.id,
    mode: 'ai',
    fallback_reason: null,
  }
}
