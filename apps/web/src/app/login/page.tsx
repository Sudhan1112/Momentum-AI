'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  FolderKanban,
  Loader2,
  Sparkles,
  Target,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { LoginButton } from '@/components/LoginButton'

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const callbackError = new URLSearchParams(window.location.search).get('error')
    if (callbackError) setError(callbackError)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/')
        router.refresh()
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setError('Check your email for the confirmation link.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,#dcecff_0%,#f5f9ff_32%,#f7fbff_54%,#eef4fb_100%)] text-[#0f172a] lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(15,108,189,0.05)_1px,transparent_1px),linear-gradient(rgba(15,108,189,0.05)_1px,transparent_1px)] bg-[size:36px_36px] opacity-60" />
      <div className="pointer-events-none absolute left-[-12%] top-[-8%] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(15,108,189,0.22)_0%,rgba(15,108,189,0)_68%)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-12%] right-[-10%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(17,94,163,0.18)_0%,rgba(17,94,163,0)_68%)] blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="flex flex-col px-6 pb-14 pt-10 sm:px-8 lg:min-h-0 lg:px-12 lg:py-7 xl:px-16 xl:py-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f6cbd_0%,#115ea3_100%)] text-white shadow-[0_14px_30px_rgba(15,108,189,0.28)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-lg font-bold tracking-tight text-[#0f172a]">Momentum AI</span>
                <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0f6cbd]">Execution workspace</span>
              </div>
            </Link>
          </div>

          <div className="mt-12 lg:mt-7 xl:mt-9">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#cfe0f5] bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#175cd3] shadow-[0_10px_24px_rgba(15,108,189,0.08)] backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-[#0f6cbd]" />
              Plan. Track. Recover.
            </div>

            <h1 className="mt-6 max-w-3xl text-[42px] font-semibold leading-[1.02] tracking-[-0.04em] text-[#101828] sm:text-[56px] lg:mt-4 lg:text-[52px] xl:text-[60px]">
              Keep projects moving
              <span className="block text-[#0f6cbd]">before deadlines slip.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#475467] sm:text-xl lg:mt-4 lg:text-base lg:leading-7 xl:text-lg">
              Momentum AI turns scattered tasks, blockers, and schedules into one execution system with daily priorities,
              risk visibility, and AI-backed recovery guidance.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-3 lg:mt-6">
              {[
                { icon: FolderKanban, label: 'Project clarity', copy: 'See every project, owner, and status in one workspace.' },
                { icon: CalendarDays, label: 'Daily planning', copy: 'Convert long goals into today’s realistic plan.' },
                { icon: BrainCircuit, label: 'AI recovery', copy: 'Spot risk early and get next-step recommendations.' },
              ].map(({ icon: Icon, label, copy }) => (
                <div
                  key={label}
                  className="rounded-[24px] border border-[#dbe7f5] bg-white/80 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.06)] backdrop-blur lg:p-3 xl:p-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#0f6cbd]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[#101828] lg:mt-3">{label}</p>
                  <p className="mt-2 text-sm leading-6 text-[#667085] lg:leading-5 xl:leading-6">{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden">
            <div className="rounded-[28px] border border-[#d9e6f5] bg-[#0d1726] p-5 text-white shadow-[0_28px_70px_rgba(10,20,38,0.26)] lg:p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#98b3d6]">Daily brief</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Execution score at a glance</h2>
                </div>
                <div className="rounded-2xl bg-[#0f6cbd] px-3 py-2 text-right shadow-[0_12px_26px_rgba(15,108,189,0.28)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d9ebff]">Score</p>
                  <p className="text-2xl font-semibold">82</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98b3d6]">Open tasks</p>
                  <p className="mt-2 text-2xl font-semibold">24</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98b3d6]">At risk</p>
                  <p className="mt-2 text-2xl font-semibold text-[#fdb022]">3</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98b3d6]">Blocked</p>
                  <p className="mt-2 text-2xl font-semibold text-[#f97066]">1</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-[#1d3b63] bg-[linear-gradient(180deg,rgba(15,108,189,0.18)_0%,rgba(255,255,255,0.02)_100%)] p-4">
                <div className="flex items-center gap-2 text-[#d9ebff]">
                  <Target className="h-4 w-4" />
                  <p className="text-sm font-semibold">Momentum suggests</p>
                </div>
                <p className="mt-3 text-base leading-7 text-white">
                  Move the product demo milestone into today’s first block and clear the API blocker before it cascades across the week.
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#dbe7f5] bg-white/85 p-5 shadow-[0_20px_46px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#667085]">Workspace pulse</p>
                <span className="rounded-full bg-[#ecfdf3] px-3 py-1 text-xs font-semibold text-[#027a48]">Healthy</span>
              </div>

              <div className="mt-4 space-y-3">
                {[
                  {
                    icon: Sparkles,
                    tone: 'bg-[#eff8ff] text-[#175cd3]',
                    title: 'Today’s plan is ready',
                    copy: 'Four priority actions are sequenced around your deadlines.',
                  },
                  {
                    icon: AlertTriangle,
                    tone: 'bg-[#fff7ed] text-[#b54708]',
                    title: 'One project needs attention',
                    copy: 'A delivery task is trending late and needs recovery planning.',
                  },
                  {
                    icon: ArrowRight,
                    tone: 'bg-[#f2f4f7] text-[#344054]',
                    title: 'Cross-team visibility',
                    copy: 'See project state, recent changes, and next actions in one place.',
                  },
                ].map(({ icon: Icon, tone, title, copy }) => (
                  <div key={title} className="rounded-2xl border border-[#eaecf0] bg-[#fcfdff] p-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#101828]">{title}</p>
                        <p className="mt-1 text-sm leading-6 text-[#667085]">{copy}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-auto hidden pt-4 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#667085]">© 2026 Momentum AI</p>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 pb-12 pt-2 sm:px-8 lg:min-h-0 lg:px-8 lg:py-5 xl:px-12">
          <div className="w-full max-w-[520px] rounded-[32px] border border-[#d9e6f5] bg-white/88 p-6 shadow-[0_32px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8 lg:p-5 xl:p-6">
            <div className="rounded-[26px] border border-[#d9e6f5] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="flex rounded-2xl bg-[#eef4fb] p-1.5">
                <button
                  onClick={() => {
                    setIsLogin(true)
                    setError(null)
                  }}
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    isLogin ? 'bg-white text-[#101828] shadow-[0_10px_24px_rgba(15,23,42,0.08)]' : 'text-[#667085]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setIsLogin(false)
                    setError(null)
                  }}
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    !isLogin ? 'bg-white text-[#101828] shadow-[0_10px_24px_rgba(15,23,42,0.08)]' : 'text-[#667085]'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <div className="px-2 pb-2 pt-6 text-center lg:pt-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f6cbd_0%,#115ea3_100%)] text-white shadow-[0_14px_30px_rgba(15,108,189,0.24)] lg:h-12 lg:w-12">
                  <BrainCircuit className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-[30px] font-semibold tracking-tight text-[#101828] lg:mt-3 lg:text-2xl">
                  {isLogin ? 'Enter your execution workspace' : 'Create your Momentum workspace'}
                </h2>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#667085]">
                  {isLogin
                    ? 'Open your projects, today’s plan, and AI guidance from one focused control center.'
                    : 'Start turning schedules, blockers, and team work into a trackable execution system.'}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 lg:mt-4">
              {[
                { label: 'Projects', value: 'Live', tone: 'text-[#175cd3]' },
                { label: 'Priorities', value: 'Daily', tone: 'text-[#101828]' },
                { label: 'Risk view', value: 'Early', tone: 'text-[#b54708]' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-[#eaecf0] bg-[#fcfdff] px-3 py-3 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#667085]">{stat.label}</p>
                  <p className={`mt-1 text-base font-semibold ${stat.tone}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {error && (
              <div className="mt-6 rounded-2xl border border-[#f1c0c0] bg-[#fff8f8] px-4 py-3 text-center text-sm font-medium text-[#b42318]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4 lg:mt-4 lg:space-y-3">
              <div className="space-y-2">
                <label className="pl-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#667085]">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="h-12 w-full rounded-2xl border border-[#d0d5dd] bg-white px-4 text-sm text-[#101828] outline-none transition placeholder:text-[#98a2b3] hover:border-[#98a2b3] focus:border-[#0f6cbd] focus:shadow-[0_0_0_4px_rgba(15,108,189,0.12)]"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between pl-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#667085]">Password</label>
                  {isLogin && (
                    <Link href="#" className="text-xs font-semibold text-[#0f6cbd] transition hover:text-[#115ea3]">
                      Forgot password?
                    </Link>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 w-full rounded-2xl border border-[#d0d5dd] bg-white px-4 text-sm text-[#101828] outline-none transition placeholder:text-[#98a2b3] hover:border-[#98a2b3] focus:border-[#0f6cbd] focus:shadow-[0_0_0_4px_rgba(15,108,189,0.12)]"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0f6cbd_0%,#115ea3_100%)] text-sm font-semibold text-white shadow-[0_16px_32px_rgba(15,108,189,0.24)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLogin ? 'Sign In to Momentum AI' : 'Create Workspace'}
              </button>
            </form>

            <div className="relative my-7 lg:my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e4e7ec]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                  Or continue with
                </span>
              </div>
            </div>

            <LoginButton
              onClick={handleGoogleLogin}
              loading={loading}
              className="h-12 rounded-2xl bg-[#111827] text-white shadow-[0_16px_30px_rgba(17,24,39,0.14)] hover:bg-[#0b1220]"
            />

            <div className="mt-6 rounded-2xl border border-[#e4eef9] bg-[#f7fbff] px-4 py-4 lg:hidden">
              <p className="text-sm font-semibold text-[#101828]">What happens after sign in</p>
              <p className="mt-1 text-sm leading-6 text-[#667085]">
                You’ll land in your workspace portfolio, then move into projects, daily planning, and Momentum AI execution insights.
              </p>
            </div>

            <div className="mt-6 text-center lg:hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#667085]">© 2026 Momentum AI</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
