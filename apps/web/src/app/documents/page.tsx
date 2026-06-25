'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bell,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderOpen,
  Grid2X2,
  Home,
  Layers,
  List,
  LogOut,
  Menu,
  MoreHorizontal,
  PencilLine,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { notify } from '@/lib/notify'

type DashboardProfile = {
  id?: string
  email?: string | null
  full_name?: string | null
  avatar_url?: string | null
}

type DashboardMember = {
  id: string
  document_id: string
  user_id: string
  role: string
  profiles?: DashboardProfile | DashboardProfile[] | null
}

type AuthUser = {
  id: string
  email?: string | null
  user_metadata?: {
    full_name?: string
    avatar_url?: string
  }
}

type Document = {
  id: string
  title: string
  updated_at: string
  created_at: string
  owner_id: string
  owner?: DashboardProfile | null
  members: DashboardMember[]
}
type Template = {
  id: string
  label: string
  description: string
  tag: string
  preview: 'blank' | 'lines' | 'blocks' | 'avatar' | 'grid' | 'banner'
  image?: string
}

const TEMPLATES: Template[] = [
  { id: 'blank', label: 'Blank', description: 'Start fresh', tag: 'Empty', preview: 'blank' },
  { id: 'meeting', label: 'Meeting Notes', description: 'Agenda & actions', tag: 'Professional', preview: 'lines', image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=400&h=533&fit=crop&q=80' },
  { id: 'blog', label: 'Blog Post', description: 'Editorial flow', tag: 'Editorial', preview: 'blocks', image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=400&h=533&fit=crop&q=80' },
  { id: 'resume', label: 'Resume', description: 'Career profile', tag: 'Career', preview: 'avatar', image: 'https://images.unsplash.com/photo-1586281380117-5a60ae2050cc?w=400&h=533&fit=crop&q=80' },
  { id: 'proposal', label: 'PRD', description: 'Product scope', tag: 'Product', preview: 'grid', image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=533&fit=crop&q=80' },
  { id: 'newsletter', label: 'Newsletter', description: 'Updates & news', tag: 'Comms', preview: 'banner' },
  { id: 'project', label: 'Project Plan', description: 'Milestones', tag: 'Product', preview: 'grid' },
  { id: 'notes', label: 'Class Notes', description: 'Study material', tag: 'Academic', preview: 'lines' },
  { id: 'brief', label: 'Creative Brief', description: 'Campaign details', tag: 'Creative', preview: 'blocks' },
  { id: 'onboarding', label: 'Onboarding', description: 'New hire flow', tag: 'HR', preview: 'lines' },
]

const SIDEBAR_NAV = [
  { icon: Home, label: 'Home', key: 'home' },
  { icon: FileText, label: 'Documents', key: 'documents' },
  { icon: Layers, label: 'Templates', key: 'templates' },
  { icon: Users, label: 'Shared', key: 'shared' },
  { icon: Trash2, label: 'Trash', key: 'trash' },
]

const MOBILE_NAV = [
  { icon: Home, label: 'Home', key: 'home' },
  { icon: FolderOpen, label: 'Files', key: 'documents' },
  { icon: User, label: 'Account', key: 'account' },
]

const DOC_THUMB_GRADIENTS = [
  'linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%)',
  'linear-gradient(180deg, #ffffff 0%, #f7fafd 100%)',
  'linear-gradient(180deg, #ffffff 0%, #fff9f1 100%)',
  'linear-gradient(180deg, #ffffff 0%, #f8f6ff 100%)',
]

function formatEdited(ts: string) {
  const d = new Date(ts)
  const diff = Date.now() - d.getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function normalizeProfile(profile?: DashboardProfile | DashboardProfile[] | null) {
  if (Array.isArray(profile)) return profile[0] ?? null
  return profile ?? null
}

function profileName(profile?: DashboardProfile | null, fallback = 'Unknown user') {
  return profile?.full_name || profile?.email || fallback
}

function profileInitials(profile?: DashboardProfile | null, fallback = 'U') {
  const source = profileName(profile, fallback)
  const parts = source.split(/[ @._-]+/).filter(Boolean)
  if (parts.length === 0) return fallback.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function dedupeProfiles(profiles: Array<DashboardProfile | null | undefined>) {
  const seen = new Set<string>()
  const result: DashboardProfile[] = []

  for (const profile of profiles) {
    if (!profile) continue
    const key = profile.id || profile.email
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(profile)
  }

  return result
}

function collaboratorProfiles(doc: Document) {
  return dedupeProfiles(
    doc.members
      .filter((member) => member.user_id !== doc.owner_id)
      .map((member) => normalizeProfile(member.profiles))
  )
}

function visibleAudience(doc: Document, currentUserId?: string) {
  if (doc.owner_id === currentUserId) {
    return collaboratorProfiles(doc)
  }

  return dedupeProfiles([
    doc.owner,
    ...doc.members
      .filter((member) => member.user_id !== currentUserId)
      .map((member) => normalizeProfile(member.profiles)),
  ])
}

function documentAccessText(doc: Document, currentUserId?: string) {
  if (doc.owner_id === currentUserId) {
    const count = collaboratorProfiles(doc).length
    if (count === 0) return 'Private'
    return count === 1 ? 'Shared with 1 person' : `Shared with ${count} people`
  }

  return `Shared by ${profileName(doc.owner, 'Someone')}`
}

function documentWorkspaceMessage() {
  return 'Document workspace is not ready yet. Run the document database setup, reload the schema, then refresh.'
}

export default function DashboardPage() {
  const router = useRouter()
  const templatesRef = useRef<HTMLElement | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [user, setUser] = useState<AuthUser | null>(null)
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
  const [actionOpen, setActionOpen] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [sidebarKey, setSidebarKey] = useState('home')
  const [topTab, setTopTab] = useState<'recent' | 'shared' | 'drafts'>('recent')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState('home')
  const [trashedDocs, setTrashedDocs] = useState<string[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [sortOption, setSortOption] = useState<'recent' | 'created' | 'title_asc' | 'title_desc'>('recent')
  const [sortOpen, setSortOpen] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('lumina_trashed_docs')
      if (stored) setTrashedDocs(JSON.parse(stored))
    } catch {}
  }, [])

  const saveTrashed = (docs: string[]) => {
    setTrashedDocs(docs)
    localStorage.setItem('lumina_trashed_docs', JSON.stringify(docs))
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
    })
  }, [router])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setLoadingError(null)

    fetch('/api/documents', { cache: 'no-store' })
      .then(async (response) => {
        const data = await readResponsePayload<Document[]>(response)
        if (!response.ok) {
          throw new Error(getResponseErrorMessage(data, 'Failed to load documents.'))
        }

        const hydrated = Array.isArray(data)
          ? data.map((doc) => ({
              ...doc,
              owner: normalizeProfile(doc.owner),
              members: Array.isArray(doc.members) ? doc.members : [],
            }))
          : []

        setDocuments(hydrated)
      })
      .catch((error) => {
        console.error(error)
        setDocuments([])
        setLoadingError(documentWorkspaceMessage())
      })
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    const close = () => { setActionOpen(null); setAccountOpen(false); setShowNotifications(false); setSortOpen(false) }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])

  const filtered = useMemo(() => {
    let list = documents.filter((d) => {
      const query = search.toLowerCase()
      return d.title.toLowerCase().includes(query) || profileName(d.owner, '').toLowerCase().includes(query)
    })
    
    if (sidebarKey === 'trash') {
      list = list.filter((d) => trashedDocs.includes(d.id))
    } else {
      list = list.filter((d) => !trashedDocs.includes(d.id))
      if (sidebarKey === 'shared' || topTab === 'shared') list = list.filter((d) => d.owner_id !== user?.id)
      else if (topTab === 'drafts') list = list.filter((d) => (d.title.toLowerCase().includes('draft') || d.title.trim() === 'Untitled document') && d.owner_id === user?.id)
      else list = list.filter((d) => d.owner_id === user?.id)
    }

    if (sortOption === 'recent') {
      list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    } else if (sortOption === 'created') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (sortOption === 'title_asc') {
      list.sort((a, b) => a.title.localeCompare(b.title))
    } else if (sortOption === 'title_desc') {
      list.sort((a, b) => b.title.localeCompare(a.title))
    }

    return list
  }, [documents, search, sidebarKey, topTab, trashedDocs, user?.id, sortOption])

  const sharedWithMe = useMemo(
    () => documents.filter((d) => d.owner_id !== user?.id && !trashedDocs.includes(d.id)).slice(0, 5),
    [documents, trashedDocs, user?.id]
  )
  const sharedPreview = useMemo(
    () => documents.filter((d) => d.owner_id !== user?.id && !trashedDocs.includes(d.id)).slice(0, 3),
    [documents, trashedDocs, user?.id]
  )
  const activeDocuments = useMemo(
    () => documents.filter((d) => !trashedDocs.includes(d.id)),
    [documents, trashedDocs]
  )
  const ownedCount = useMemo(
    () => activeDocuments.filter((d) => d.owner_id === user?.id).length,
    [activeDocuments, user?.id]
  )
  const sharedCount = useMemo(
    () => activeDocuments.filter((d) => d.owner_id !== user?.id).length,
    [activeDocuments, user?.id]
  )
  const privateCount = useMemo(
    () => activeDocuments.filter((d) => d.owner_id === user?.id && collaboratorProfiles(d).length === 0).length,
    [activeDocuments, user?.id]
  )

  const createDoc = async (template: Template) => {
    if (!user) return
    setCreatingId(template.id)
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: template.id === 'blank' ? 'Untitled document' : template.label }),
      })
      const data = await readResponsePayload<{ id: string }>(response)
      if (!response.ok) {
        throw new Error(getResponseErrorMessage(data, 'Failed to create document.'))
      }
      if (!data?.id) {
        throw new Error('Document was created without an id.')
      }
      router.push(`/doc/${data.id}${template.id === 'blank' ? '' : `?template=${template.id}`}`)
      closeMobileNav()
    } catch (error) {
      console.error(error)
      notify.error('Could not create document. Check the document database setup and try again.')
    } finally {
      setCreatingId(null)
    }
  }

  const createBlankDoc = () => { const blank = TEMPLATES.find((t) => t.id === 'blank'); if (blank) void createDoc(blank) }

  const handleRename = async (docId: string) => {
    const nextTitle = renameValue.trim()
    if (!nextTitle) { setRenaming(null); return }
    const { error } = await createClient().from('documents').update({ title: nextTitle }).eq('id', docId)
    if (error) { notify.error('Could not rename document. Please try again.'); return }
    setDocuments((docs) => docs.map((doc) => doc.id === docId ? { ...doc, title: nextTitle } : doc))
    setRenaming(null)
  }

  const handleDelete = async (docId: string, permanently = false) => {
    if (permanently) {
      if (!confirm('Delete this document permanently?')) return
      const { error } = await createClient().from('documents').delete().eq('id', docId)
      if (error) { notify.error('Could not delete document. Please try again.'); return }
      setDocuments((docs) => docs.filter((doc) => doc.id !== docId))
      saveTrashed(trashedDocs.filter(id => id !== docId))
      notify.success('Document deleted permanently')
    } else {
      if (!trashedDocs.includes(docId)) {
        saveTrashed([...trashedDocs, docId])
        notify.success('Moved to Trash')
      }
    }
  }

  const handleRestore = (docId: string) => {
    saveTrashed(trashedDocs.filter(id => id !== docId))
  }

  const signOut = async () => { await createClient().auth.signOut(); router.push('/login') }

  const initials = user?.user_metadata?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'
  const avatarUrl = user?.user_metadata?.avatar_url
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Writer'
  const firstName = displayName.split(/[ .]/).filter(Boolean)[0] || 'Writer'
  const isSidebarCollapsed = !sidebarOpen && !mobileNavOpen

  const onSidebarClick = (key: string) => {
    setSidebarKey(key)
    if (key === 'templates') templatesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (key === 'shared') setTopTab('shared')
    else if (key === 'home' || key === 'documents') setTopTab('recent')
    closeMobileNav()
  }

  const SidebarInner = (
    <>
      <div className={`mb-8 mt-2 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3 px-3'}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3ede2] text-[#9a5b2b] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <FileText className="h-6 w-6" strokeWidth={2} />
        </div>
        {!isSidebarCollapsed && (
          <div className="min-w-0 flex flex-col justify-center">
            <p className="text-[1.05rem] font-bold tracking-tight text-[#1f2937] whitespace-nowrap">Momentum AI</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#8a7f72] whitespace-nowrap mt-0.5">Execution Workspace</p>
          </div>
        )}
        <button
          type="button"
          className="ml-auto rounded-xl p-1.5 text-[#7b746b] md:hidden"
          onClick={(e) => { e.stopPropagation(); closeMobileNav() }}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className={`flex-1 ${isSidebarCollapsed ? 'space-y-2 px-2' : 'space-y-1.5'}`}>
        {SIDEBAR_NAV.map(({ icon: Icon, label, key }) => {
          const active = sidebarKey === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSidebarClick(key)}
              title={isSidebarCollapsed ? label : undefined}
              className={`flex w-full items-center text-left text-sm font-medium transition-all ${
                isSidebarCollapsed
                  ? 'justify-center rounded-2xl px-0 py-3'
                  : 'gap-4 rounded-2xl px-4 py-3'
              } ${
                active
                  ? 'bg-[#f3ede2] text-[#9a5b2b] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
                  : 'text-[#4b5563] hover:bg-[#f6f1e8]'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={active ? 2.2 : 1.8} />
              {!isSidebarCollapsed && <span className="text-xs font-semibold uppercase tracking-[0.22em]">{label}</span>}
            </button>
          )
        })}
      </nav>

      <div className="relative space-y-4 border-t pt-5" style={{ borderColor: '#ece5d8' }}>
        <div
          className={`cursor-pointer rounded-2xl border border-[#ece5d8] bg-[#fbfaf7] transition hover:border-[#e2d6c0] ${
            isSidebarCollapsed ? 'flex justify-center p-2.5' : 'flex items-center gap-3 p-3'
          }`}
          onClick={(e) => { e.stopPropagation(); setAccountOpen((v) => !v) }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-10 w-10 rounded-2xl object-cover flex-shrink-0" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1f2937] text-xs font-bold text-white flex-shrink-0">
              {initials}
            </div>
          )}
          {!isSidebarCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#1f2937]">{displayName}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-[#8a7f72]" style={{ transform: accountOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
            </>
          )}
        </div>

        {accountOpen && (
          <div className={`rounded-2xl border border-[#ece5d8] bg-white p-1.5 shadow-[0_10px_24px_rgba(31,41,55,0.08)] ${isSidebarCollapsed ? 'absolute bottom-2 left-[5.5rem] w-36 z-50' : ''}`}>
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#a33a2b] transition-colors hover:bg-[#fff4f1]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[linear-gradient(180deg,#f7f3ec_0%,#f2ece2_100%)] text-[#202124]">
      {/* Mobile overlay */}
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(34,32,29,0.28)', backdropFilter: 'blur(4px)' }}
          onClick={closeMobileNav}
          aria-label="Close menu"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col px-4 py-6 transition-all duration-300 md:relative md:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0 w-[280px]' : (sidebarOpen ? 'w-[280px] -translate-x-full md:translate-x-0' : 'w-[96px] -translate-x-full md:translate-x-0')
        }`}
        style={{ background: 'rgba(255,255,255,0.88)', borderRight: '1px solid #ece5d8', backdropFilter: 'blur(18px)' }}
      >
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-8 z-10 hidden h-7 w-7 items-center justify-center rounded-full border border-[#dfd5c5] bg-white shadow-[0_8px_18px_rgba(31,41,55,0.12)] transition-all hover:bg-[#faf6ef] md:flex"
        >
          <Menu className="h-3.5 w-3.5 text-[#6b5f52]" strokeWidth={2.2}/>
        </button>
        {SidebarInner}
      </aside>

      {/* ── Main ── */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-transparent">
        {/* ── Header ── */}
        <header
          className="sticky top-0 z-30 flex h-16 w-full flex-shrink-0 items-center justify-between gap-3 border-b border-[#e6ded0] bg-[#faf7f1]/90 px-4 backdrop-blur md:px-6"
        >
          {/* Left: hamburger + search */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              className="rounded-xl p-2 md:hidden"
              style={{ color: 'var(--color-on-surface-variant)' }}
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              href="/"
              className="hidden items-center gap-2 rounded-full border border-[#ebe2d4] bg-white px-3 py-2 text-sm font-semibold text-[#6b5f52] transition hover:border-[#d9c7ab] hover:text-[#9a5b2b] md:inline-flex"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            <div className="relative hidden max-w-xl flex-1 sm:block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5f6368]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents"
                className="h-11 w-full rounded-full border border-[#ebe2d4] bg-white py-2 pl-11 pr-4 text-sm text-[#202124] outline-none transition focus:border-[#d9c7ab] focus:shadow-[0_1px_2px_rgba(60,64,67,0.12),0_4px_12px_rgba(83,67,48,0.08)]"
              />
            </div>
          </div>

          {/* Right: tabs + actions */}
          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
            {/* Tabs — desktop only */}
            <div className="hidden items-center gap-5 md:flex">
              {(['recent', 'shared', 'drafts'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setTopTab(tab); setSidebarKey(tab === 'shared' ? 'shared' : 'home') }}
                  className="pb-0.5 text-sm font-medium transition-colors"
                  style={{
                    color: topTab === tab ? '#9a5b2b' : '#6b5f52',
                    borderBottom: topTab === tab ? '2px solid #9a5b2b' : '2px solid transparent',
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pl-2" style={{ borderLeft: '1px solid #e0e3e7' }}>
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={(e) => { e.stopPropagation(); setShowNotifications(!showNotifications) }} className="relative hidden rounded-full p-2 text-[#5f6368] transition-colors hover:bg-[#f1f3f4] sm:block" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  {sharedWithMe.length > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#d93025]"></span>}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 top-full z-50 mt-3 w-80 overflow-hidden rounded-[24px] border border-[#e6ded0] bg-white/95 backdrop-blur-[12px] shadow-[0_16px_40px_rgba(83,67,48,0.12)]">
                    <h3 className="border-b border-[#ece5d8] px-5 py-4 text-sm font-bold text-[#1f2937]">Notifications</h3>
                    {sharedWithMe.length === 0 ? (
                      <p className="px-5 py-6 text-sm text-[#6b5f52]">No new shared documents.</p>
                    ) : (
                      <div className="max-h-80 overflow-y-auto p-2">
                        {sharedWithMe.map(doc => (
                          <button key={doc.id} type="button" onClick={() => router.push(`/doc/${doc.id}`)} className="flex w-full items-start gap-3 rounded-[18px] px-3 py-3 text-left transition hover:bg-[#f6f1e8]">
                            <ProfileAvatar profile={doc.owner} className="h-10 w-10 text-xs" />
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-1 text-sm font-medium text-[#1f2937]">{doc.title}</p>
                              <p className="mt-0.5 text-xs text-[#9a5b2b]">Shared by {profileName(doc.owner, 'Someone')}</p>
                              <p className="mt-1 text-xs text-[#6b5f52]">Updated {formatEdited(doc.updated_at)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={createBlankDoc}
                disabled={creatingId !== null}
                className="hidden shrink-0 items-center gap-2 rounded-full bg-[#1a73e8] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_6px_rgba(26,115,232,0.35)] transition hover:bg-[#1765cc] disabled:opacity-50 sm:inline-flex"
              >
                <Plus className="h-4 w-4" />
                New Document
              </button>
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto pb-24 md:pb-8">
          <div className="mx-auto w-full max-w-[1480px] space-y-10 px-4 py-6 sm:px-6 lg:px-8">

            <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
              <div className="rounded-[32px] bg-[linear-gradient(135deg,#24372b_0%,#101815_100%)] px-7 py-8 text-white shadow-[0_24px_50px_rgba(16,24,21,0.22)] sm:px-9">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
                  Momentum AI
                </div>
                <h1 className="mt-5 text-[2rem] font-normal leading-tight text-white sm:text-[2.6rem]" style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}>
                  Welcome back, {firstName}.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                  A calmer execution workspace for drafting, reviewing, and sharing work without the clutter. Everything below is aligned to Momentum AI and your real collaboration data.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Owned</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{ownedCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Shared</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{sharedCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Private</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{privateCount}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-[#e6ded0] bg-white/88 p-6 shadow-[0_18px_38px_rgba(83,67,48,0.08)] backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8a7f72]">Today in Momentum AI</p>
                    <h2 className="mt-3 text-2xl font-semibold text-[#1f2937]">Workspace snapshot</h2>
                  </div>
                  <div className="rounded-2xl bg-[#f6f1e8] px-3 py-2 text-xs font-medium text-[#9a5b2b]">
                    {activeDocuments.length} active docs
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-[#f8f5ef] p-4">
                    <p className="text-sm font-semibold text-[#1f2937]">Shared with you</p>
                    <p className="mt-1 text-sm leading-6 text-[#6b5f52]">
                      {sharedWithMe.length === 0
                        ? 'No incoming shares yet.'
                        : `${sharedWithMe.length} documents are waiting for your attention, with real owner avatars and actual shared members.`}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#f8f5ef] p-4">
                    <p className="text-sm font-semibold text-[#1f2937]">Latest activity</p>
                    <p className="mt-1 text-sm leading-6 text-[#6b5f52]">
                      {activeDocuments[0]
                        ? `${activeDocuments[0].title} was updated ${formatEdited(activeDocuments[0].updated_at)}.`
                        : 'Create a document to start your writing flow.'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Templates ── */}
            <section ref={templatesRef} className="rounded-[28px] border border-[#e6ded0] bg-white/88 px-5 py-6 shadow-[0_18px_38px_rgba(83,67,48,0.08)] backdrop-blur md:px-7">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-[1.75rem] font-normal text-[#202124]">
                    Start a new document
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5f6368]">
                    Select a specialized canvas
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={createBlankDoc}
                    disabled={creatingId !== null}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1765cc] disabled:opacity-50 sm:hidden"
                  >
                    <Plus className="h-4 w-4" />
                    New Document
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGallery(!showGallery)}
                    className="hidden items-center gap-2 text-sm font-medium text-[#6b5f52] sm:inline-flex hover:text-[#1a73e8] transition-colors"
                  >
                    Template gallery
                    {showGallery ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className={showGallery ? "flex flex-wrap gap-4 px-2 pb-2 mt-2" : "no-scrollbar -mx-2 flex gap-4 overflow-x-auto scroll-smooth px-2 pb-2"}>
                {(showGallery ? TEMPLATES : TEMPLATES.slice(0, 6)).map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    creating={creatingId === template.id}
                    onSelect={() => createDoc(template)}
                  />
                ))}
              </div>
            </section>

            {/* ── Recent Documents ── */}
            {loadingError && (
              <div className="rounded-2xl border border-[#eadfce] bg-[#fbf7f0] px-4 py-3 text-sm text-[#6b5f52]">
                {loadingError}
              </div>
            )}

            <section>
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-[1.95rem] font-normal text-[#202124]">
                  {sidebarKey === 'trash' ? 'Trash' : topTab === 'shared' || sidebarKey === 'shared' ? 'Shared with you' : topTab === 'drafts' ? 'Drafts' : 'Recent documents'}
                  </h2>
                  <p className="mt-1 text-sm text-[#5f6368]">
                    {sidebarKey === 'trash'
                      ? 'Locally hidden documents that you can restore or remove.'
                      : topTab === 'shared' || sidebarKey === 'shared'
                        ? 'Documents that were actually shared with your account.'
                        : 'A refined Momentum AI dashboard for your recent writing.'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex rounded-2xl bg-[#f1f3f4] p-1">
                    <button
                      type="button"
                      onClick={() => setView('grid')}
                      className="rounded-xl p-2 transition-colors"
                      style={{ background: view === 'grid' ? '#ffffff' : undefined, color: view === 'grid' ? '#1a73e8' : '#5f6368', boxShadow: view === 'grid' ? '0 1px 2px rgba(60,64,67,0.18)' : 'none' }}
                      aria-label="Grid view"
                    >
                      <Grid2X2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('list')}
                      className="rounded-xl p-2 transition-colors"
                      style={{ background: view === 'list' ? '#ffffff' : undefined, color: view === 'list' ? '#1a73e8' : '#5f6368', boxShadow: view === 'list' ? '0 1px 2px rgba(60,64,67,0.18)' : 'none' }}
                      aria-label="List view"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSortOpen(v => !v) }}
                      className="hidden items-center gap-2 rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5f6368] sm:flex hover:bg-[#f1f3f4] transition-colors"
                    >
                      <span>{sortOption === 'recent' ? 'Sort by Recent' : sortOption === 'created' ? 'Recently Created' : sortOption === 'title_asc' ? 'Title (A-Z)' : 'Title (Z-A)'}</span>
                      <ChevronDown className="h-3 w-3" style={{ transform: sortOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
                    </button>
                    {sortOpen && (
                      <div className="absolute right-0 top-full mt-2 w-40 overflow-hidden rounded-xl border border-[#e0e3e7] bg-white py-1 shadow-[0_10px_24px_rgba(60,64,67,0.12)] z-50">
                        <button
                          type="button"
                          onClick={() => { setSortOption('recent'); setSortOpen(false) }}
                          className="flex w-full items-center px-4 py-2 text-sm text-[#202124] hover:bg-[#f1f3f4] text-left"
                        >
                          Sort by Recent
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSortOption('created'); setSortOpen(false) }}
                          className="flex w-full items-center px-4 py-2 text-sm text-[#202124] hover:bg-[#f1f3f4] text-left"
                        >
                          Recently Created
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSortOption('title_asc'); setSortOpen(false) }}
                          className="flex w-full items-center px-4 py-2 text-sm text-[#202124] hover:bg-[#f1f3f4] text-left"
                        >
                          Title (A-Z)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSortOption('title_desc'); setSortOpen(false) }}
                          className="flex w-full items-center px-4 py-2 text-sm text-[#202124] hover:bg-[#f1f3f4] text-left"
                        >
                          Title (Z-A)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'space-y-2'}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-48 animate-pulse rounded-[24px] border border-[#e0e3e7] bg-white" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  title={
                    sidebarKey === 'trash'
                      ? 'Trash is empty'
                      : topTab === 'shared' || sidebarKey === 'shared'
                        ? 'No shared documents yet'
                        : search
                          ? 'No documents match your search.'
                          : 'No documents yet.'
                  }
                  subtitle={
                    topTab === 'shared' || sidebarKey === 'shared'
                      ? 'When someone shares a document with you, it will show up here with the real owner avatar.'
                      : search
                        ? 'Try a different keyword.'
                        : 'Create one from the templates above.'
                  }
                />
              ) : view === 'grid' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((doc, i) => (
                    <article
                      key={doc.id}
                      onClick={() => !renaming && router.push(`/doc/${doc.id}`)}
                      className="group relative cursor-pointer overflow-hidden rounded-[24px] border border-[#e0e3e7] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.18)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(60,64,67,0.18)]"
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-[4/3] overflow-hidden border-b border-[#eef0f1] bg-[#fafafa] p-4">
                        <div
                          className="absolute inset-0 opacity-90"
                          style={{ background: DOC_THUMB_GRADIENTS[i % DOC_THUMB_GRADIENTS.length] }}
                        />
                        <div className="absolute inset-4 rounded-[18px] border border-[#e6e8eb] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.08)]" />
                        <div className="absolute inset-x-8 top-8 h-2 rounded-full" style={{ width: '34%', background: ['#1a73e8', '#188038', '#c5221f', '#9334e6'][i % 4] }} />
                        <div className="absolute inset-x-8 top-14 h-1.5 rounded-full bg-[#d7dbe0]" style={{ width: '52%' }} />
                        <div className="absolute inset-x-8 top-20 h-1.5 rounded-full bg-[#eceff1]" style={{ width: '72%' }} />
                        <div className="absolute inset-x-8 h-1.5 rounded-full bg-[#eceff1]" style={{ top: '6.5rem', width: '66%' }} />
                        <div className="absolute bottom-8 left-8 right-8 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-[#f8f9fa] p-3">
                            <div className="mb-2 h-1.5 w-2/3 rounded-full bg-[#d7dbe0]" />
                            <div className="mb-2 h-1.5 w-full rounded-full bg-[#eceff1]" />
                            <div className="h-1.5 w-4/5 rounded-full bg-[#eceff1]" />
                          </div>
                          <div className="rounded-xl bg-[#f8f9fa] p-3">
                            <div className="mb-2 h-1.5 w-1/2 rounded-full bg-[#d7dbe0]" />
                            <div className="mb-2 h-1.5 w-full rounded-full bg-[#eceff1]" />
                            <div className="h-1.5 w-3/4 rounded-full bg-[#eceff1]" />
                          </div>
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="mb-1.5 flex items-start justify-between gap-2 p-4 pb-0">
                        {renaming === doc.id ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => handleRename(doc.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(doc.id); if (e.key === 'Escape') setRenaming(null) }}
                            className="w-full rounded-xl border border-[#d2e3fc] bg-[#f8fbff] px-3 py-2 text-sm font-semibold text-[#202124] outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <Link href={`/doc/${doc.id}`} className="line-clamp-2 flex-1 text-[1.05rem] font-medium leading-6 text-[#202124]">
                            {doc.title}
                          </Link>
                        )}
                        {(sidebarKey === 'trash' || doc.owner_id === user?.id) && (
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setActionOpen(actionOpen === doc.id ? null : doc.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-[#5f6368] transition-colors hover:bg-[#f1f3f4]"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {actionOpen === doc.id && (
                            <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-44 overflow-hidden rounded-2xl border border-[#e0e3e7] bg-white p-1.5 shadow-[0_16px_40px_rgba(60,64,67,0.18)]">
                              {sidebarKey === 'trash' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => { setActionOpen(null); handleRestore(doc.id) }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#1a73e8] transition-colors hover:bg-[#f8fbff]"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                    Restore
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setActionOpen(null); handleDelete(doc.id, true) }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#d93025] transition-colors hover:bg-[#fce8e6]"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete forever
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => { setRenaming(doc.id); setRenameValue(doc.title); setActionOpen(null) }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#202124] transition-colors hover:bg-[#f8f9fa]"
                                  >
                                    <PencilLine className="h-4 w-4" />
                                    Rename
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setActionOpen(null); handleDelete(doc.id) }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#d93025] transition-colors hover:bg-[#fce8e6]"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Trash
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        )}
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#eef0f1] px-4 pb-4 pt-4">
                        <div className="min-w-0 flex-1">
                          {visibleAudience(doc, user?.id).length > 0 ? (
                            <AvatarStack profiles={visibleAudience(doc, user?.id)} max={3} />
                          ) : (
                            <span className="text-xs font-medium text-[#5f6368]">
                              {doc.owner_id === user?.id ? 'Only you can access this' : 'Shared directly with you'}
                            </span>
                          )}
                          <p className="mt-2 text-xs text-[#5f6368]">{documentAccessText(doc, user?.id)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium text-[#202124]">
                            {doc.owner_id === user?.id ? 'You' : profileName(doc.owner, 'Unknown')}
                          </p>
                          <p className="text-xs text-[#5f6368]">Edited {formatEdited(doc.updated_at)}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                /* List view */
                <div className="overflow-hidden rounded-[28px] border border-[#e0e3e7] bg-white">
                  {filtered.map((doc) => (
                    <div
                      key={doc.id}
                      className="grid items-center gap-3 border-b border-[#eef0f1] px-4 py-4 transition-colors hover:bg-[#f8f9fa]"
                      style={{ gridTemplateColumns: '40px minmax(0,1fr) 160px auto' }}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f0fe]">
                        <FileText className="h-4 w-4 text-[#1a73e8]" />
                      </div>
                      <div className="min-w-0">
                        {renaming === doc.id ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => handleRename(doc.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(doc.id); if (e.key === 'Escape') setRenaming(null) }}
                            className="w-full rounded-xl border border-[#d2e3fc] bg-[#f8fbff] px-3 py-2 text-sm font-semibold text-[#202124] outline-none"
                          />
                        ) : (
                          <Link href={`/doc/${doc.id}`} className="block truncate text-sm font-semibold text-[#202124] hover:underline">
                            {doc.title}
                          </Link>
                        )}
                        <p className="mt-1 text-xs text-[#5f6368]">{documentAccessText(doc, user?.id)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ProfileAvatar profile={doc.owner} className="h-8 w-8 text-[10px]" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-[#202124]">{doc.owner_id === user?.id ? 'You' : profileName(doc.owner, 'Unknown')}</p>
                          <p className="text-xs text-[#5f6368]">{new Date(doc.updated_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        {visibleAudience(doc, user?.id).length > 0 && <AvatarStack profiles={visibleAudience(doc, user?.id)} max={3} />}
                        {sidebarKey === 'trash' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRestore(doc.id)}
                              className="rounded-full px-3 py-1.5 text-xs font-medium text-[#1a73e8] transition-colors hover:bg-[#f8fbff]"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(doc.id, true)}
                              className="rounded-full px-3 py-1.5 text-xs font-medium text-[#d93025] transition-colors hover:bg-[#fce8e6]"
                            >
                              Delete
                            </button>                           
                          </>
                        ) : doc.owner_id === user?.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => { setRenaming(doc.id); setRenameValue(doc.title) }}
                              className="rounded-full px-3 py-1.5 text-xs font-medium text-[#5f6368] transition-colors hover:bg-[#f1f3f4]"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(doc.id)}
                              className="rounded-full px-3 py-1.5 text-xs font-medium text-[#d93025] transition-colors hover:bg-[#fce8e6]"
                            >
                              Trash
                            </button>
                          </>
                        ) : (
                          <span className="rounded-full bg-[#f1f3f4] px-3 py-1.5 text-xs font-medium text-[#5f6368]">
                            Shared
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Shared with me ── */}
            {topTab !== 'shared' && sidebarKey !== 'shared' && sidebarKey !== 'trash' && (
              <section className="pb-8">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-[1.75rem] font-normal text-[#202124]">Shared with you</h2>
                    <p className="mt-1 text-sm text-[#5f6368]">Real shared documents only. No placeholder people.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setTopTab('shared'); setSidebarKey('shared') }}
                    className="rounded-full px-4 py-2 text-sm font-medium text-[#1a73e8] transition hover:bg-[#f8fbff]"
                  >
                    View all
                  </button>
                </div>
                {sharedPreview.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-[#dadce0] bg-[#fbfbfb] px-6 py-12 text-center">
                    <p className="text-lg font-medium text-[#202124]">No shared documents yet</p>
                    <p className="mt-2 text-sm text-[#5f6368]">
                      When someone shares a document with you, it will show up here with their avatar.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    {sharedPreview.map((doc, index) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => router.push(`/doc/${doc.id}`)}
                        className="rounded-[24px] border border-[#e0e3e7] bg-white p-5 text-left shadow-[0_1px_2px_rgba(60,64,67,0.18)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(60,64,67,0.18)]"
                      >
                        <div className="mb-4 flex items-start gap-3">
                          <ProfileAvatar profile={doc.owner} className="h-11 w-11 text-xs" />
                          <div className="min-w-0">
                            <p className="truncate text-base font-medium text-[#202124]">{doc.title}</p>
                            <p className="mt-1 text-sm text-[#5f6368]">Shared by {profileName(doc.owner, 'Someone')}</p>
                          </div>
                        </div>

                        <div className="mb-4 rounded-2xl border border-[#eef0f1] bg-[#fafafa] p-3">
                          <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] border border-[#e6e8eb] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
                            <div className="absolute inset-0 opacity-90" style={{ background: DOC_THUMB_GRADIENTS[index % DOC_THUMB_GRADIENTS.length] }} />
                            <div className="absolute inset-x-6 top-6 h-2 rounded-full bg-[#1a73e8]" style={{ width: '34%' }} />
                            <div className="absolute inset-x-6 top-12 h-1.5 rounded-full bg-[#d7dbe0]" style={{ width: '48%' }} />
                            <div className="absolute inset-x-6 h-1.5 rounded-full bg-[#eceff1]" style={{ top: '4.5rem', width: '68%' }} />
                            <div className="absolute bottom-6 left-6 right-6 rounded-xl bg-[#f8f9fa] p-3">
                              <div className="mb-2 h-1.5 w-3/4 rounded-full bg-[#d7dbe0]" />
                              <div className="mb-2 h-1.5 w-full rounded-full bg-[#eceff1]" />
                              <div className="h-1.5 w-2/3 rounded-full bg-[#eceff1]" />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <AvatarStack profiles={visibleAudience(doc, user?.id)} max={4} />
                          <span className="text-xs text-[#5f6368]">Updated {formatEdited(doc.updated_at)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

          </div>
        </div>

        {/* ── Mobile Bottom Nav ── */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2 md:hidden"
          style={{ background: 'rgba(250,247,241,0.96)', backdropFilter: 'blur(20px)', borderTop: '1px solid #e6ded0' }}
        >
          {MOBILE_NAV.map(({ icon: Icon, label, key }) => {
            const active = mobileTab === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMobileTab(key)
                  if (key === 'home') { setSidebarKey('home'); setTopTab('recent') }
                  if (key === 'documents') onSidebarClick('documents')
                  if (key === 'account') { setAccountOpen(true); setMobileNavOpen(true) }
                }}
                className="flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all"
                style={{ background: active ? '#f3ede2' : undefined, minWidth: 60 }}
              >
                <Icon className="h-5 w-5" style={{ color: active ? '#9a5b2b' : '#6b5f52' }} strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: active ? '#9a5b2b' : '#6b5f52' }}>{label}</span>
              </button>
            )
          })}
        </nav>

        {/* ── Mobile FAB ── */}
        <button
          type="button"
          onClick={createBlankDoc}
          disabled={creatingId !== null}
          className="fixed bottom-20 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-60 md:hidden"
          style={{ background: 'linear-gradient(135deg, #c57b3f 0%, #9a5b2b 100%)', boxShadow: '0 14px 28px rgba(154,91,43,0.32)' }}
          aria-label="New document"
        >
          <Plus className="h-6 w-6 text-white" strokeWidth={2.5} />
        </button>
      </main>
    </div>
  )
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-[#dadce0] bg-[#fbfbfb] py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f0fe]">
        <FileText className="h-6 w-6 text-[#1a73e8]" />
      </div>
      <p className="text-lg font-medium text-[#202124]">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-[#5f6368]">{subtitle}</p>
    </div>
  )
}

function ProfileAvatar({ profile, className = 'h-8 w-8 text-[10px]' }: { profile?: DashboardProfile | null; className?: string }) {
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profileName(profile)}
        className={`${className} rounded-full object-cover`}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div className={`${className} flex items-center justify-center rounded-full bg-[#d2e3fc] font-semibold text-[#174ea6]`}>
      {profileInitials(profile)}
    </div>
  )
}

function AvatarStack({ profiles, max = 3 }: { profiles: DashboardProfile[]; max?: number }) {
  const visible = profiles.slice(0, max)

  if (visible.length === 0) {
    return <span className="text-xs text-[#5f6368]">No collaborators</span>
  }

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((profile, index) => (
        <div key={profile.id || profile.email || `${profileName(profile)}-${index}`} className="rounded-full border-2 border-white bg-white">
          <ProfileAvatar profile={profile} className="h-8 w-8 text-[10px]" />
        </div>
      ))}
    </div>
  )
}

function TemplatePreview({ kind }: { kind: Template['preview'] }) {
  if (kind === 'blank') return null
  const lines: Record<string, number[][]> = {
    lines: [[100], [85], [65], [90], [70]],
    blocks: [[100], [100], [55]],
    avatar: [[30, 60], [100], [80]],
    grid: [[47, 47], [47, 47]],
    banner: [[100], [70], [85], [60]],
  }
  const ls = lines[kind] || []
  return (
    <div className="mb-3 flex flex-1 flex-col rounded-xl border border-[#e6e8eb] bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfc_100%)] p-3">
      {kind === 'avatar' && (
        <div className="mb-3 h-8 w-8 rounded-full bg-[#d7aefb]" />
      )}
      {ls.map((row, ri) => (
        <div key={ri} className="flex gap-1.5">
          {row.map((w, wi) => (
            <div key={wi} className="h-1.5 rounded-full" style={{ width: `${w}%`, background: wi === 0 && ri === 0 ? '#aecbfa' : '#eceff1' }} />
          ))}
        </div>
      ))}
    </div>
  )
}

function TemplateCard({ template, creating, onSelect }: { template: Template; creating: boolean; onSelect: () => void }) {
  if (template.preview === 'blank') {
    return (
      <div className="relative mb-4 flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={onSelect}
          disabled={creating}
          className="group relative flex h-[200px] w-[150px] flex-shrink-0 flex-col items-center justify-center rounded-2xl border border-[#dadce0] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.12)] transition-all hover:border-[#1a73e8] hover:shadow-[0_8px_24px_rgba(60,64,67,0.15)] disabled:opacity-60"
        >
          <Plus className="h-10 w-10 text-red-500" strokeWidth={1} style={{ stroke: 'url(#blue-red-yellow-green)' }} />
          <svg width="0" height="0">
            <linearGradient id="blue-red-yellow-green" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4285F4" />
              <stop offset="50%" stopColor="#EA4335" />
              <stop offset="100%" stopColor="#34A853" />
            </linearGradient>
          </svg>
          {creating && (
            <div className="absolute inset-0 flex items-center justify-center rounded-[4px] bg-white/60">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1a73e8] border-t-transparent" />
            </div>
          )}
        </button>
        <span className="text-sm font-medium text-gray-800">{template.label}</span>
        <span className="text-sm text-[#5f6368]">{template.description}</span>
      </div>
    )
  }

  return (
    <div className="relative mb-4 flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={onSelect}
        disabled={creating}
        className="group relative flex h-[200px] w-[150px] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-[#dadce0] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.12)] transition-all hover:border-[#1a73e8] hover:shadow-[0_8px_24px_rgba(60,64,67,0.15)] disabled:opacity-60"
      >
        <TemplatePreview kind={template.preview} />
        {creating && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/60">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1a73e8] border-t-transparent" />
          </div>
        )}
      </button>
      <span className="text-sm font-medium text-gray-800">{template.label}</span>
      <span className="text-sm text-[#5f6368]">{template.description}</span>
    </div>
  )
}
