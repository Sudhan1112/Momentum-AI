'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, FileText, FolderKanban, Home, Sparkles } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/planner', label: 'Planner', icon: CalendarDays },
  { href: '/momentum', label: 'Momentum', icon: Sparkles },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden min-h-screen w-[248px] shrink-0 border-r border-[#e8dece] bg-white/78 px-4 py-5 text-[#2d241c] backdrop-blur-xl lg:flex lg:flex-col">
      <Link href="/" className="flex items-center gap-3 rounded-xl px-2 py-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#9a5b2b] text-white shadow-[0_10px_22px_rgba(154,91,43,0.22)]">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight">Momentum AI</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a7f72]">Execution</p>
        </div>
      </Link>

      <nav className="mt-8 space-y-1.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? 'bg-[#f3ede2] text-[#9a5b2b] shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]'
                  : 'text-[#655a50] hover:bg-[#f8f3ea] hover:text-[#2d241c]'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={active ? 2.3 : 1.9} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto rounded-xl border border-[#eadfce] bg-[#fbf7f0] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7f72]">Today</p>
        <p className="mt-2 text-sm leading-5 text-[#4f453d]">Focus on one next action, then let the rest of the workspace orbit that.</p>
      </div>
    </aside>
  )
}
