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
      <header className="sticky top-0 z-30 border-b border-[#e0e0e0] bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#9a5b2b] text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-[#2d241c]">Momentum AI</span>
          </Link>

          <label className="hidden h-8 max-w-lg flex-1 items-center gap-2 rounded border border-[#c7c7c7] bg-[#fafafa] px-2.5 lg:flex"><Search className="h-4 w-4 text-[#616161]" /><input className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search projects and tasks" aria-label="Search" /></label>

          <div className="ml-auto flex items-center gap-3">
            <button className="hidden h-9 w-9 items-center justify-center rounded hover:bg-[#f5f5f5] sm:flex" aria-label="Notifications"><Bell className="h-4 w-4" /></button>
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-2 rounded-xl border border-[#eadfce] bg-white/74 px-2.5 py-2 text-left transition hover:border-[#d6c4aa] hover:bg-white"
              aria-label="Sign out"
              title="Sign out"
            >
              <UserAvatar user={user} size="sm" rounded="lg" />
              <span className="hidden max-w-[140px] truncate text-sm font-semibold text-[#2d241c] sm:block">
                {displayNameForUser(user)}
              </span>
              <LogOut className="hidden h-4 w-4 text-[#6b5f52] sm:block" />
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
