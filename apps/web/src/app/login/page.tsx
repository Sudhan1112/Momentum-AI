'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, FileText, Loader2 } from 'lucide-react'
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
    <div className="flex min-h-screen w-full flex-col lg:flex-row" style={{ background: 'linear-gradient(135deg, #f7f2e9 0%, #fbf7f0 48%, #efe7db 100%)', color: '#1f2937' }}>
      
      {/* ── Background Ambient Orbs ── */}
      <div className="fixed -left-[12%] top-[-10%] h-[48vh] w-[42vw] rounded-full blur-[120px] opacity-50 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(154,91,43,0.18) 0%, transparent 72%)' }} />
      <div className="fixed bottom-[-12%] right-[-10%] h-[40vh] w-[36vw] rounded-full blur-[120px] opacity-45 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(36,55,43,0.16) 0%, transparent 72%)' }} />

      {/* ── Left Column: Hero ── */}
      <div className="relative flex flex-col justify-between px-6 py-12 lg:w-5/12 lg:px-16 lg:py-20 z-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #c57b3f 0%, #9a5b2b 100%)', boxShadow: '0 10px 24px rgba(154,91,43,0.22)' }}>
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">Momentum AI</span>
          </Link>
        </div>

        <div className="mt-16 sm:mt-24 lg:mt-0">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.72)', borderColor: '#e8decf', color: '#6b5f52' }}>
            <span className="flex h-2 w-2 rounded-full bg-[#9a5b2b]" />
            Momentum AI workspace
          </div>
          
          <h1 className="text-4xl font-light leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl" style={{ fontFamily: 'Newsreader, Georgia, serif' }}>
            A calmer desk <br className="hidden lg:block"/>
            for writing that <span className="italic" style={{ color: '#9a5b2b' }}>flows</span>.
          </h1>
          
          <p className="mt-6 max-w-md text-lg leading-relaxed" style={{ color: '#6b5f52' }}>
            Momentum AI brings projects, schedules, teams, and execution intelligence together so meaningful work keeps moving.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            {[
              { icon: <FileText className="w-4 h-4 text-[#c57b3f]" />, label: 'Focused Writing' },
              { icon: <CheckCircle2 className="w-4 h-4 text-[#9a5b2b]" />, label: 'Smart Templates' },
              { icon: <CheckCircle2 className="w-4 h-4 text-[#2f6b4f]" />, label: 'Real-time Sync' }
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium" style={{ background: 'rgba(255,255,255,0.76)', borderColor: '#e8decf' }}>
                {feature.icon}
                {feature.label}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 hidden items-center justify-start lg:flex">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#8a7f72', opacity: 0.9 }}>
            © 2026 Momentum AI
          </p>
        </div>
      </div>

      {/* ── Right Column: Auth Card ── */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12 z-10">
        <div className="w-full max-w-md rounded-[32px] border p-8 shadow-[0_24px_48px_rgba(83,67,48,0.12)] transition-all sm:p-10" style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(30px)', borderColor: '#e7dece' }}>
          
          {/* Tabs */}
          <div className="mb-8 flex space-x-1 rounded-2xl p-1.5" style={{ background: '#f3ede2' }}>
            <button
              onClick={() => { setIsLogin(true); setError(null) }}
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${isLogin ? 'shadow-sm' : ''}`}
              style={{
                background: isLogin ? '#ffffff' : 'transparent',
                color: isLogin ? '#1f2937' : '#7b746b',
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(null) }}
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${!isLogin ? 'shadow-sm' : ''}`}
              style={{
                background: !isLogin ? '#ffffff' : 'transparent',
                color: !isLogin ? '#1f2937' : '#7b746b',
              }}
            >
              Sign Up
            </button>
          </div>

          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">{isLogin ? 'Welcome back' : 'Create an account'}</h2>
            <p className="mt-2 text-sm" style={{ color: '#6b5f52' }}>
              {isLogin ? 'Enter your details to access your workspace.' : 'Join to start planning and delivering projects.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border p-3 text-sm text-center font-medium" style={{ background: '#fff4f1', borderColor: '#f2d4cd', color: '#a33a2b' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="pl-1 text-xs font-bold uppercase tracking-widest" style={{ color: '#7b746b' }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: '#fbfaf7',
                  borderColor: '#e7dece',
                  color: '#1f2937'
                }}
                onFocus={(e) => e.target.style.borderColor = '#9a5b2b'}
                onBlur={(e) => e.target.style.borderColor = '#e7dece'}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between pl-1">
                <label className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7b746b' }}>Password</label>
                {isLogin && <Link href="#" className="text-xs font-semibold transition-colors hover:text-[#9a5b2b]" style={{ color: '#7b746b' }}>Forgot password?</Link>}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: '#fbfaf7',
                  borderColor: '#e7dece',
                  color: '#1f2937'
                }}
                onFocus={(e) => e.target.style.borderColor = '#9a5b2b'}
                onBlur={(e) => e.target.style.borderColor = '#e7dece'}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="mt-2 w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50 hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #c57b3f 0%, #9a5b2b 100%)', color: '#fffaf4', boxShadow: '0 10px 24px rgba(154,91,43,0.22)' }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" style={{ borderColor: '#eadfcd' }} /></div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
              <span className="px-4" style={{ background: 'rgba(255,255,255,0.88)', color: '#8a7f72' }}>Or continue with</span>
            </div>
          </div>

          <LoginButton onClick={handleGoogleLogin} loading={loading} />

          {/* Mobile Footer */}
          <div className="mt-8 text-center lg:hidden">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#8a7f72', opacity: 0.9 }}>
              © 2026 Momentum AI
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
