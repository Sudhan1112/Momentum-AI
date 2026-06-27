'use client'

import { useState, type FormEvent } from 'react'
import { BrainCircuit, Loader2, Search, Sparkles } from 'lucide-react'

import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { notify } from '@/lib/notify'
import type { AskMomentumAnswer } from '@/types/project-intelligence'

const SUGGESTED_QUESTIONS = [
  'What changed this week?',
  'Why was the deadline changed?',
  'Who blocked this project?',
  'Why is execution score lower?',
] as const

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function formatDay(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function importanceClass(value: AskMomentumAnswer['evidence'][number]['importance']) {
  if (value === 'critical') return 'bg-[#fff0ea] text-[#a33a2b] border-[#f1c7b5]'
  if (value === 'high') return 'bg-[#fff6dc] text-[#8a5b00] border-[#ecd9a0]'
  if (value === 'normal') return 'bg-[#eef5f0] text-[#2f6b4f] border-[#cfe0d5]'
  return 'bg-[#f3ede2] text-[#6b5f52] border-[#e4d9c9]'
}

export function AskMomentumPanel({ projectId }: { projectId: string }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<AskMomentumAnswer | null>(null)

  async function submitQuestion(nextQuestion: string) {
    const trimmed = nextQuestion.trim()
    if (!trimmed) {
      notify.error('Enter a question for Momentum.')
      return
    }

    setLoading(true)
    const response = await fetch(`/api/projects/${projectId}/intelligence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: trimmed }),
    })
    const body = await readResponsePayload<AskMomentumAnswer | { error: string }>(response)
    setLoading(false)

    if (!response.ok) {
      notify.error(getResponseErrorMessage(body, 'Momentum could not answer that question.'))
      return
    }

    setAnswer(body as AskMomentumAnswer)
    setQuestion(trimmed)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submitQuestion(question)
  }

  return (
    <section className="rounded-[24px] border border-[#d8e8de] bg-[#f7fbf8] p-5">
      <div className="flex items-center gap-2">
        <BrainCircuit className="h-4 w-4 text-[#2f6b4f]" />
        <h3 className="text-lg font-semibold text-[#2d241c]">Ask Momentum</h3>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#4c6557]">
        Ask a question about project history and get an evidence-backed answer from Momentum Memory.
      </p>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <label className="block">
          <span className="sr-only">Ask Momentum</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-[#c8dacd] bg-white px-4 py-3 text-sm text-[#2d241c] outline-none focus:border-[#2f6b4f]"
            placeholder="Why was the deadline changed?"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setQuestion(item)
                void submitQuestion(item)
              }}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#2f6b4f] transition hover:bg-[#eef5f0]"
            >
              {item}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#2f6b4f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Ask Momentum
        </button>
      </form>

      {answer ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-[#d8e8de] bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#eef5f0] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2f6b4f]">
                {answer.intent.replace(/_/g, ' ')}
              </span>
              <span className="rounded-full bg-[#fbf7f0] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b5f52]">
                {answer.mode === 'ai' ? 'AI + evidence' : 'Deterministic fallback'}
              </span>
              {answer.ai_run_id ? (
                <span className="rounded-full bg-[#fbf7f0] px-2.5 py-1 text-[11px] font-semibold text-[#6b5f52]">
                  AI run logged
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm font-semibold text-[#2d241c]">{answer.summary}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#4c6557]">{answer.answer}</p>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#2f6b4f]" />
              <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#2f6b4f]">Evidence</h4>
            </div>

            {answer.evidence.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-[#c8dacd] bg-white p-4 text-sm text-[#4c6557]">
                Momentum answered from current project state because there was no matching timeline evidence yet.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {answer.evidence.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-[#d8e8de] bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#2d241c]">{item.summary}</p>
                        <p className="mt-1 text-xs text-[#6b5f52]">
                          {formatDay(item.occurred_at)} at {formatTime(item.occurred_at)} by {item.actor.label}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${importanceClass(item.importance)}`}>
                        {item.importance}
                      </span>
                    </div>
                    {item.reason ? <p className="mt-3 text-sm leading-6 text-[#4c6557]">{item.reason}</p> : null}
                    {item.facts.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.facts.map((fact) => (
                          <span key={`${item.id}-${fact.label}`} className="rounded-full bg-[#f7fbf8] px-3 py-1.5 text-xs font-semibold text-[#4c6557]">
                            {fact.label}: {fact.value}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
