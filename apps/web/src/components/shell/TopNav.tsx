'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, CalendarDays, FolderKanban, Home, LogOut, Search, Sparkles } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

import { displayNameForUser } from '@/lib/avatar'
import { UserAvatar } from '@/components/shell/UserAvatar'
import { createClient } from '@/lib/supabase/client'

const MOBILE_NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/planner', label: 'Planner', icon: CalendarDays },
  { href: '/momentum', label: 'Momentum', icon: Sparkles },
]

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
      <header className="sticky top-0 z-30 border-b border-[#dbe7f3] bg-white/80 px-4 py-3 shadow-[0_4px_20px_rgba(15,65,115,0.04)] backdrop-blur-xl sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#2d9cff_0%,#0f6cbd_100%)] text-white shadow-[0_8px_20px_rgba(15,108,189,0.25)]">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-[#102a43]">Momentum AI</span>
          </Link>

          <label className="fluent-input-shell hidden max-w-xl flex-1 lg:flex"><Search className="h-4 w-4 text-[#667085]" /><input className="min-w-0 flex-1 bg-transparent text-sm text-[#101828] outline-none" placeholder="Search projects and tasks" aria-label="Search" /></label>

          <div className="ml-auto flex items-center gap-3">
            <button className="hidden h-10 w-10 items-center justify-center rounded-xl border border-transparent text-[#667085] transition hover:border-[#e4e7ec] hover:bg-white sm:flex" aria-label="Notifications"><Bell className="h-4 w-4" /></button>
            <button
              type="button"
              onClick={signOut}
              className="flex h-10 items-center gap-2 rounded-2xl border border-[#e4e7ec] bg-white px-2.5 text-left shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
              aria-label="Sign out"
              title="Sign out"
            >
              <UserAvatar user={user} size="sm" rounded="lg" />
              <span className="hidden max-w-[140px] truncate text-sm font-semibold text-[#102a43] sm:block">
                {displayNameForUser(user)}
              </span>
              <LogOut className="hidden h-4 w-4 text-[#64748b] sm:block" />
            </button>
          </div>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t border-[#d5e4f3] bg-white/92 px-2 py-2 shadow-[0_-12px_30px_rgba(15,65,115,0.08)] backdrop-blur-xl lg:hidden">
        {MOBILE_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold uppercase tracking-[0.08em] transition ${
                active ? 'bg-[#eaf4ff] text-[#0f6cbd]' : 'text-[#64748b]'
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
