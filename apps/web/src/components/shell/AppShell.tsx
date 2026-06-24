'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/shell/Sidebar'
import { TopNav } from '@/components/shell/TopNav'

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let mounted = true
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!mounted) return
        if (!data.user) {
          router.push('/login')
          return
        }
        setUser(data.user)
      })
      .finally(() => {
        if (mounted) setCheckingSession(false)
      })

    return () => {
      mounted = false
    }
  }, [router])

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f3ec] text-[#9a5b2b]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    )
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen bg-[#f7f3ec] text-[#2d241c]">
      <Sidebar />
      <div className="min-w-0 flex-1 pb-20 lg:pb-0">
        <TopNav user={user} />
        {children}
      </div>
    </div>
  )
}
