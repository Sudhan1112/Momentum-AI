'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays, FileText, FolderKanban, Home, LogOut, Sparkles } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'

const MOBILE_NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/planner', label: 'Planner', icon: CalendarDays },
  { href: '/momentum', label: 'Momentum', icon: Sparkles },
]

function initialsFor(user: User | null) {
  const fullName = user?.user_metadata?.full_name as string | undefined
  const email = user?.email ?? ''
  if (fullName) {
    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
  }
  return email.slice(0, 1).toUpperCase() || 'M'
}

function displayNameFor(user: User | null) {
  const fullName = user?.user_metadata?.full_name as string | undefined
  return fullName || user?.email?.split('@')[0] || 'Executor'
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function TopNav({ user }: { user: User | null }) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#e8dece] bg-[#f8f3ea]/92 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#9a5b2b] text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-[#2d241c]">Momentum AI</span>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            <span className="rounded-full border border-[#eadfce] bg-white/78 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">
              Execute
            </span>
            <span className="text-sm font-medium text-[#6b5f52]">Today</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/documents"
              className="hidden items-center gap-2 rounded-xl border border-[#eadfce] bg-white/74 px-3 py-2 text-sm font-semibold text-[#4f453d] transition hover:border-[#d6c4aa] hover:text-[#9a5b2b] sm:inline-flex"
            >
              <FileText className="h-4 w-4" />
              Documents
            </Link>
            <div className="flex items-center gap-2 rounded-xl border border-[#eadfce] bg-white/74 px-2.5 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2d241c] text-xs font-bold text-white">
                {initialsFor(user)}
              </div>
              <span className="hidden max-w-[140px] truncate text-sm font-semibold text-[#2d241c] sm:block">
                {displayNameFor(user)}
              </span>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#eadfce] bg-white/74 text-[#6b5f52] transition hover:border-[#d6c4aa] hover:text-[#9a5b2b]"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t border-[#e8dece] bg-[#fbf7f0]/96 px-2 py-2 backdrop-blur-xl lg:hidden">
        {MOBILE_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold uppercase tracking-[0.08em] transition ${
                active ? 'bg-[#f3ede2] text-[#9a5b2b]' : 'text-[#6b5f52]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
