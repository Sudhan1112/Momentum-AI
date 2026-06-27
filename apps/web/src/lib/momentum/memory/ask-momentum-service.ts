import 'server-only'

import { executeAiTextCapability, type AiExecutionContext } from '@/lib/momentum/ai/executor'
import { intentionallyCitationless, withCitations } from '@/lib/momentum/ai/gateway'
import { getProjectExecutionScore } from '@/lib/momentum/execution-score'
import { badRequest } from '@/lib/momentum/errors'
import { getProject } from '@/lib/momentum/projects/project-service'
import { listProjectTasks } from '@/lib/momentum/tasks/task-service'
import { isOverdueTimestamp } from '@/lib/momentum/date'
import type {
  AskMomentumAnswer,
  AskMomentumEvidenceItem,
  AskMomentumIntent,
} from '@/types/project-intelligence'
import type { ProjectDetail } from '@/types/project'
import type { TaskItem } from '@/types/task'

import { listProjectTimeline } from './project-intelligence-service'

const MAX_EVIDENCE_ITEMS = 5

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'because',
  'did',
  'do',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'its',
  'me',
  'of',
  'on',
  'or',
  'our',
  'the',
  'this',
  'to',
  'was',
  'we',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
])

type DeterministicAskMomentum = {
  question: string
  intent: AskMomentumIntent
  project: Pick<ProjectDetail, 'id' | 'title' | 'status' | 'target_deadline'>
  tasks: Array<Pick<TaskItem, 'id' | 'title' | 'status' | 'priority' | 'due_at' | 'blocked_reason'>>
  execution_score: {
    score: number
    explanation: string
    overdue_tasks: number
    blocked_tasks: number
    open_tasks: number
  }
  summary: string
  answer: string
  evidence: AskMomentumEvidenceItem[]
}

function normalizeQuestion(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length < 3) {
    throw badRequest('question must be at least 3 characters')
  }
  if (normalized.length > 500) {
    throw badRequest('question must be 500 characters or fewer')
  }
  return normalized
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
}

export function classifyAskMomentumQuestion(question: string): AskMomentumIntent {
  const normalized = question.trim().toLowerCase()

  if (normalized.includes('execution score') || normalized.includes('score lower') || normalized.includes('score dropped')) {
    return 'execution_score'
  }

  if (normalized.includes('deadline') || normalized.includes('due date') || normalized.includes('schedule')) {
    return 'deadline_history'
  }

  if (normalized.includes('blocked') || normalized.includes('blocker') || normalized.includes('unblock')) {
    return 'blockers'
  }

  if (normalized.includes('decision') || normalized.includes('decide') || normalized.includes('postpone') || normalized.includes('delay')) {
    return 'decisions'
  }

  if (
    normalized.includes('what changed') ||
    normalized.includes('changed this') ||
    normalized.includes('since yesterday') ||
    normalized.includes('this week')
  ) {
    return 'recent_changes'
  }

  return 'generic'
}

function importanceWeight(importance: AskMomentumEvidenceItem['importance']) {
  if (importance === 'critical') return 4
  if (importance === 'high') return 3
  if (importance === 'normal') return 2
  return 1
}

function recencyWeight(occurredAt: string) {
  const diff = Math.max(0, Date.now() - new Date(occurredAt).getTime())
  const days = diff / 86_400_000
  if (days <= 1) return 4
  if (days <= 3) return 3
  if (days <= 7) return 2
  if (days <= 14) return 1
  return 0
}

function textForEvidence(item: AskMomentumEvidenceItem) {
  return [item.summary, item.reason ?? '', ...item.facts.map((fact) => `${fact.label} ${fact.value}`)].join(' ').toLowerCase()
}

function intentBoost(intent: AskMomentumIntent, item: AskMomentumEvidenceItem) {
  switch (intent) {
    case 'deadline_history':
      return item.event_type === 'project.deadline_changed'
        ? 8
        : item.event_type === 'decision.accepted' || item.event_type === 'recovery.generated' || item.event_type === 'simulation.created'
          ? 4
          : 0
    case 'blockers':
      return item.event_type === 'task.blocked'
        ? 8
        : item.event_type === 'task.unblocked'
          ? 5
          : item.event_type === 'recovery.generated'
            ? 3
            : 0
    case 'decisions':
      return item.event_type === 'decision.accepted'
        ? 8
        : item.event_type === 'project.deadline_changed' || item.event_type === 'recovery.generated'
          ? 3
          : 0
    case 'execution_score':
      return item.event_type === 'task.blocked'
        ? 6
        : item.event_type === 'task.completed'
          ? 4
          : item.event_type === 'task.deadline_changed' || item.event_type === 'project.deadline_changed'
            ? 3
            : item.event_type === 'recovery.generated'
              ? 2
              : 0
    case 'recent_changes':
      return 2
    default:
      return item.event_type === 'decision.accepted' || item.event_type === 'task.blocked' ? 2 : 0
  }
}

export function rankAskMomentumEvidence(
  item: AskMomentumEvidenceItem,
  question: string,
  intent: AskMomentumIntent
) {
  const keywords = tokenize(question)
  const haystack = textForEvidence(item)
  const overlap = keywords.reduce((total, keyword) => total + (haystack.includes(keyword) ? 2 : 0), 0)
  return overlap + intentBoost(intent, item) + importanceWeight(item.importance) + recencyWeight(item.occurred_at)
}

function selectEvidence(items: AskMomentumEvidenceItem[], question: string, intent: AskMomentumIntent) {
  const ranked = items
    .map((item) => ({ item, score: rankAskMomentumEvidence(item, question, intent) }))
    .sort((a, b) => b.score - a.score || new Date(b.item.occurred_at).getTime() - new Date(a.item.occurred_at).getTime())

  const selected = ranked.filter((entry) => entry.score > 0).slice(0, MAX_EVIDENCE_ITEMS).map((entry) => entry.item)
  if (selected.length > 0) return selected
  return items.slice(0, Math.min(MAX_EVIDENCE_ITEMS, items.length))
}

function overdueCount(tasks: DeterministicAskMomentum['tasks']) {
  return tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled' && isOverdueTimestamp(task.due_at)).length
}

function blockedTasks(tasks: DeterministicAskMomentum['tasks']) {
  return tasks.filter((task) => task.status === 'blocked')
}

function openTasks(tasks: DeterministicAskMomentum['tasks']) {
  return tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled')
}

function evidenceLine(item: AskMomentumEvidenceItem) {
  return item.reason || item.facts[0]?.value || item.summary
}

function buildRecentChangesAnswer(
  project: DeterministicAskMomentum['project'],
  evidence: AskMomentumEvidenceItem[],
  tasks: DeterministicAskMomentum['tasks']
) {
  if (evidence.length === 0) {
    return {
      summary: 'No recent project history yet',
      answer: `${project.title} does not have recorded Momentum Memory events yet. Right now it has ${openTasks(tasks).length} open task(s), so the next useful step is to create or update work and let the timeline build from there.`,
    }
  }

  const highlights = evidence.slice(0, 3).map((item) => item.summary)
  return {
    summary: `Recent changes center on ${highlights[0] ?? 'project activity'}`,
    answer: `The most important recent changes in ${project.title} are ${highlights.join('; ')}. These are the events currently shaping the project timeline and they are the best starting point for reviewing what changed.`,
  }
}

function buildDeadlineAnswer(project: DeterministicAskMomentum['project'], evidence: AskMomentumEvidenceItem[]) {
  const deadlineEvent = evidence.find((item) => item.event_type === 'project.deadline_changed')
  const decisionEvent = evidence.find((item) => item.event_type === 'decision.accepted')
  const recoveryEvent = evidence.find((item) => item.event_type === 'recovery.generated')

  if (!deadlineEvent) {
    return {
      summary: 'No recorded deadline change found',
      answer: project.target_deadline
        ? `I could not find a recorded deadline change in Momentum Memory. The current deadline is ${project.target_deadline}, so if it changed before event capture was enabled the project history does not show that reason yet.`
        : 'I could not find a recorded deadline change, and this project does not currently have a deadline set in project state.',
    }
  }

  const fact = deadlineEvent.facts.find((item) => item.label === 'Deadline')?.value ?? deadlineEvent.summary
  const reasons = [decisionEvent?.reason, recoveryEvent?.reason, deadlineEvent.reason].filter((value): value is string => Boolean(value))
  const reasonText = reasons[0] ? ` The clearest recorded reason is ${reasons[0]}.` : ''

  return {
    summary: 'Deadline history is grounded in recorded project events',
    answer: `The project deadline changed in Momentum Memory, with the latest recorded change showing ${fact}.${reasonText} I linked the deadline event and the closest supporting decision or recovery evidence so you can verify what drove the change.`,
  }
}

function buildBlockerAnswer(
  project: DeterministicAskMomentum['project'],
  tasks: DeterministicAskMomentum['tasks'],
  evidence: AskMomentumEvidenceItem[],
  question: string
) {
  const blocked = blockedTasks(tasks)
  const latestBlocker = evidence.find((item) => item.event_type === 'task.blocked') ?? evidence[0] ?? null

  if (blocked.length === 0 && !latestBlocker) {
    return {
      summary: 'No active blockers are recorded',
      answer: `${project.title} does not currently have any blocked tasks. If progress still feels stalled, the best next step is to review overdue or low-velocity work rather than blocker history.`,
    }
  }

  if (question.toLowerCase().includes('who') && latestBlocker) {
    return {
      summary: 'The latest blocker event identifies the actor',
      answer: `${latestBlocker.actor.label} most recently recorded a blocker in ${project.title} through the event "${latestBlocker.summary}". ${evidenceLine(latestBlocker)}.`,
    }
  }

  const topBlocked = blocked[0]?.title ?? latestBlocker?.summary ?? 'blocked work'
  return {
    summary: `${blocked.length} active blocker${blocked.length === 1 ? '' : 's'} are affecting execution`,
    answer: `${project.title} currently has ${blocked.length} blocked task${blocked.length === 1 ? '' : 's'}, and the most important one is ${topBlocked}. The linked evidence shows the latest blocker updates and the surrounding project events so you can see what is holding execution back and what changed next.`,
  }
}

function buildDecisionAnswer(project: DeterministicAskMomentum['project'], evidence: AskMomentumEvidenceItem[]) {
  const decisions = evidence.filter((item) => item.event_type === 'decision.accepted')
  if (decisions.length === 0) {
    return {
      summary: 'No accepted decisions are recorded yet',
      answer: `${project.title} does not have accepted decisions in Momentum Memory yet. The project timeline still shows operational events, but there is no recorded decision history to explain higher-level tradeoffs.`,
    }
  }

  const latest = decisions[0]
  return {
    summary: 'Accepted decisions are available with supporting evidence',
    answer: `The strongest recorded decision signal in ${project.title} is "${latest.summary}". I linked the accepted decision first and then the nearby evidence events so you can see both the decision itself and the factual trail around it.`,
  }
}

function buildExecutionScoreAnswer(
  project: DeterministicAskMomentum['project'],
  executionScore: DeterministicAskMomentum['execution_score'],
  evidence: AskMomentumEvidenceItem[]
) {
  const recentPressure = evidence
    .filter((item) => item.event_type === 'task.blocked' || item.event_type === 'task.deadline_changed' || item.event_type === 'project.deadline_changed')
    .slice(0, 2)
    .map((item) => item.summary)

  const pressureText =
    recentPressure.length > 0
      ? ` Recent timeline pressure includes ${recentPressure.join(' and ')}.`
      : ''

  return {
    summary: `Execution score is ${executionScore.score} with ${executionScore.overdue_tasks} overdue and ${executionScore.blocked_tasks} blocked task(s)`,
    answer: `Execution score is currently ${executionScore.score} because ${executionScore.explanation.toLowerCase()} ${executionScore.overdue_tasks} open task${executionScore.overdue_tasks === 1 ? ' is' : 's are'} overdue and ${executionScore.blocked_tasks} task${executionScore.blocked_tasks === 1 ? ' is' : 's are'} blocked in ${project.title}.${pressureText}`.trim(),
  }
}

function buildGenericAnswer(
  project: DeterministicAskMomentum['project'],
  executionScore: DeterministicAskMomentum['execution_score'],
  evidence: AskMomentumEvidenceItem[]
) {
  if (evidence.length === 0) {
    return {
      summary: 'Project memory has not accumulated enough history yet',
      answer: `${project.title} does not have enough recorded project history for a detailed answer yet. Its current execution score is ${executionScore.score}, so the best available explanation comes from the live project state rather than memory evidence.`,
    }
  }

  return {
    summary: 'Answer built from the strongest matching project evidence',
    answer: `Based on the recorded project history, the clearest answer comes from ${evidence[0].summary}. I selected the most relevant evidence events around your question so you can review what happened without depending on a vague AI summary.`,
  }
}

export function buildDeterministicAskMomentumAnswer(input: {
  question: string
  intent: AskMomentumIntent
  project: DeterministicAskMomentum['project']
  tasks: DeterministicAskMomentum['tasks']
  execution_score: DeterministicAskMomentum['execution_score']
  evidence: AskMomentumEvidenceItem[]
}) {
  switch (input.intent) {
    case 'recent_changes':
      return buildRecentChangesAnswer(input.project, input.evidence, input.tasks)
    case 'deadline_history':
      return buildDeadlineAnswer(input.project, input.evidence)
    case 'blockers':
      return buildBlockerAnswer(input.project, input.tasks, input.evidence, input.question)
    case 'decisions':
      return buildDecisionAnswer(input.project, input.evidence)
    case 'execution_score':
      return buildExecutionScoreAnswer(input.project, input.execution_score, input.evidence)
    default:
      return buildGenericAnswer(input.project, input.execution_score, input.evidence)
  }
}

function buildAiContext(deterministic: DeterministicAskMomentum): AiExecutionContext {
  const citations =
    deterministic.evidence.length > 0
      ? withCitations(
          deterministic.evidence.map((item, index) => ({
            sourceType: 'memory_entry' as const,
            sourceId: item.id,
            excerpt: [item.summary, item.reason ?? item.facts[0]?.value ?? ''].filter(Boolean).join(' — ').slice(0, 500),
            metadata: {
              project_id: item.project_id,
              event_type: item.event_type,
              occurred_at: item.occurred_at,
            },
            sortOrder: index,
          }))
        )
      : intentionallyCitationless('No project timeline evidence matched this question.')

  return {
    contextJson: JSON.stringify({
      question: deterministic.question,
      intent: deterministic.intent,
      project: deterministic.project,
      execution_score: deterministic.execution_score,
      deterministic_summary: deterministic.summary,
      deterministic_answer: deterministic.answer,
      evidence: deterministic.evidence.map((item) => ({
        id: item.id,
        event_type: item.event_type,
        summary: item.summary,
        reason: item.reason,
        occurred_at: item.occurred_at,
        actor: item.actor.label,
        facts: item.facts,
      })),
    }),
    inputSummary: `${deterministic.project.title}: ${deterministic.intent} question with ${deterministic.evidence.length} evidence item(s).`,
    citations,
  }
}

function buildAiInstruction(deterministic: DeterministicAskMomentum) {
  return [
    `Answer this project question: ${deterministic.question}`,
    'Use the deterministic answer as the source of truth.',
    'Do not invent facts, events, people, or causes.',
    'Do not change the evidence selection or claim certainty beyond the evidence.',
    'If the evidence is limited, say so plainly.',
    'Return plain text in at most four sentences.',
  ].join('\n')
}

async function buildDeterministicQuestionAnswer(projectId: string, question: string): Promise<DeterministicAskMomentum> {
  const [project, tasks, timeline, executionScore] = await Promise.all([
    getProject(projectId),
    listProjectTasks(projectId),
    listProjectTimeline(projectId),
    getProjectExecutionScore(projectId),
  ])

  const intent = classifyAskMomentumQuestion(question)
  const evidence = selectEvidence(timeline, question, intent)
  const metrics = {
    score: executionScore.score,
    explanation: executionScore.explanation,
    overdue_tasks: overdueCount(tasks),
    blocked_tasks: blockedTasks(tasks).length,
    open_tasks: openTasks(tasks).length,
  }
  const summaryAndAnswer = buildDeterministicAskMomentumAnswer({
    question,
    intent,
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
      target_deadline: project.target_deadline,
    },
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      due_at: task.due_at,
      blocked_reason: task.blocked_reason,
    })),
    execution_score: metrics,
    evidence,
  })

  return {
    question,
    intent,
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
      target_deadline: project.target_deadline,
    },
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      due_at: task.due_at,
      blocked_reason: task.blocked_reason,
    })),
    execution_score: metrics,
    summary: summaryAndAnswer.summary,
    answer: summaryAndAnswer.answer,
    evidence,
  }
}

export async function askMomentumQuestion(projectId: string, userId: string, rawQuestion: string): Promise<AskMomentumAnswer> {
  const question = normalizeQuestion(rawQuestion)
  const deterministic = await buildDeterministicQuestionAnswer(projectId, question)
  const result = await executeAiTextCapability({
    userId,
    projectId,
    capability: 'risk_explain',
    buildDeterministic: () => deterministic,
    buildContext: buildAiContext,
    buildUserInstruction: buildAiInstruction,
    temperature: 0.2,
    maxOutputTokens: 280,
  })

  return {
    question,
    intent: deterministic.intent,
    generated_at: new Date().toISOString(),
    mode: result.mode,
    fallback_reason: result.mode === 'fallback' ? result.reason : null,
    ai_run_id: result.mode === 'ai' ? result.run.id : null,
    summary: deterministic.summary,
    answer: result.mode === 'ai' ? result.text.trim() || deterministic.answer : deterministic.answer,
    evidence: deterministic.evidence,
  }
}
