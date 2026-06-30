'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, FolderKanban, LayoutDashboard } from 'lucide-react'

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
    <aside
      className={`hidden shrink-0 self-start border-r border-[#18334f] bg-[#0b2138] px-3 py-5 text-white shadow-[12px_0_36px_rgba(11,33,56,.1)] transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden ${
        collapsed ? 'w-[76px]' : 'w-[252px]'
      }`}
    >
      <Link
        href="/"
        className={`flex h-12 items-center px-1 ${
          collapsed ? 'justify-center' : 'gap-3'
        }`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1687e6] text-white shadow-[0_8px_20px_rgba(22,135,230,.24)]">
          <span className="text-lg font-black tracking-[-0.08em]">M</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-[16px] font-bold tracking-[-0.02em] text-white">Momentum AI</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#79bdf2]">Execution workspace</p>
          </div>
        )}
      </Link>

      <div className="mx-1 mt-5 h-px bg-[#24415d]" />

      <nav className={`mt-5 space-y-1.5 ${collapsed ? '' : 'px-0.5'}`}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`relative flex h-11 items-center rounded-xl text-sm font-semibold transition ${
                active
                  ? 'bg-[#1687e6] text-white shadow-[0_8px_18px_rgba(0,90,170,.24)]'
                  : 'text-[#a9bfd5] hover:bg-[#12304d] hover:text-white'
              } ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}
            >
              {active && !collapsed && <span className="absolute left-0 h-5 w-[3px] rounded-r-full bg-white" />}
              <div className="flex h-8 w-8 items-center justify-center">
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.95} />
              </div>
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto space-y-3 pt-5">
        {!collapsed && (
          <div className="flex items-center gap-3 border-t border-[#24415d] px-1 pt-4">
            <UserAvatar user={user} size="sm" rounded="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-[#93aac1]">{user?.email ?? 'Signed in'}</p>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="flex justify-center border-t border-[#24415d] pt-4">
            <UserAvatar user={user} size="sm" rounded="lg" />
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          className={`flex h-10 items-center rounded-xl text-[#91abc4] transition hover:bg-[#12304d] hover:text-white ${
            collapsed ? 'justify-center px-0' : 'px-2'
          }`}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={collapsed ? 'Expand navigation' : undefined}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="mr-2 h-4 w-4" /> Collapse
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
