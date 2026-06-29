'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, FolderKanban, Gauge, LayoutDashboard } from 'lucide-react'

import { displayNameForUser } from '@/lib/avatar'
import { UserAvatar } from '@/components/shell/UserAvatar'

const NAV_ITEMS = [
  { href: '/', label: 'Portfolio', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/planner', label: 'My work', icon: CalendarDays },
  { href: '/momentum', label: 'Momentum AI', icon: BarChart3 },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar({
  user,
  collapsed,
  onToggle,
}: {
  user: User | null
  collapsed: boolean
  onToggle: () => void
}) {
  const pathname = usePathname()
  const displayName = displayNameForUser(user)

  return (
    <aside className={`hidden shrink-0 self-start border-r border-[#e0e0e0] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fb_100%)] px-3 py-3 text-[#242424] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden ${collapsed ? 'w-[88px]' : 'w-[248px]'}`}>
      <Link href="/" className={`flex items-center rounded-2xl border border-[#e4e7ec] bg-white px-2.5 py-2 shadow-[0_8px_24px_rgba(15,108,189,0.08)] ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#c57b3f_0%,#9a5b2b_100%)] text-white shadow-[0_10px_22px_rgba(154,91,43,0.22)]">
          <Gauge className="h-5 w-5" />
        </div>
        {!collapsed && <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight">Momentum AI</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0f6cbd]">Project workspace</p>
        </div>}
      </Link>

      <nav className={`mt-6 space-y-2 ${collapsed ? 'px-1' : ''}`}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? 'bg-[#eaf3ff] text-[#0f6cbd] shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]'
                  : 'text-[#4a4a4a] hover:bg-white hover:text-[#111827]'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={active ? 2.3 : 1.9} />
              {!collapsed && label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto space-y-3">
        {!collapsed ? (
          <div className="rounded-2xl border border-[#dce6f6] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9fe_100%)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0f6cbd]">Today</p>
            <p className="mt-2 text-sm leading-5 text-[#3f4754]">Work the next action, clear blockers fast, and let the schedule stay visible.</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="rounded-2xl border border-[#dce6f6] bg-white p-2 shadow-sm">
              <UserAvatar user={user} size="sm" rounded="lg" />
            </div>
          </div>
        )}

        {!collapsed && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#e4e7ec] bg-white px-3 py-3">
            <UserAvatar user={user} size="sm" rounded="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#111827]">{displayName}</p>
              <p className="truncate text-xs text-[#667085]">{user?.email ?? 'Signed in'}</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          className={`flex h-10 items-center rounded-xl border border-[#e4e7ec] bg-white text-[#475467] transition hover:border-[#cbd5e1] hover:bg-[#f8fafc] ${collapsed ? 'justify-center' : 'px-3'}`}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={collapsed ? 'Expand navigation' : undefined}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="mr-2 h-4 w-4" /> Collapse</>}
        </button>
      </div>
    </aside>
  )
}
