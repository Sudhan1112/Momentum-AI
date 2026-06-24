'use client'

import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { TextSelection } from '@tiptap/pm/state'
import type { User } from '@supabase/supabase-js'
import * as Y from 'yjs'
import { yDocToProsemirrorJSON } from '@tiptap/y-tiptap'
import { type ChangeEvent, type CSSProperties, type ElementType, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { notify } from '@/lib/notify'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Bell,
  Bold,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  FileDown,
  FileText,
  GitBranch,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  LockKeyhole,
  MessageSquareQuote,
  Minus,
  PanelLeftClose,
  PanelRightClose,
  RemoveFormatting,
  Strikethrough,
  Type,
  Underline as UnderlineIcon,
  WifiOff,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { base64ToUint8Array, uint8ArrayToBase64 } from '@/lib/base64'
import { getResponseErrorMessage, readResponsePayload } from '@/lib/http'
import { useCollabEditor } from '@/hooks/useCollabEditor'
import { PresenceBar } from './PresenceBar'
import { ShareModal } from './ShareModal'
import { VersionHistoryPanel } from './VersionHistoryPanel'
import { type CommentItem, CommentsPanel } from './CommentsPanel'
import { editorExtensions } from './editorExtensions'

type ShareMember = {
  id: string
  role: string
  user_id?: string
  profiles?: { email?: string; full_name?: string; avatar_url?: string } | null
}

type OutlineHeading = { text: string; level: number; pos: number }

type AccessRequestItem = {
  id: string
  document_id: string
  user_id: string
  requested_role: string
  current_role?: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  profiles?: { email?: string | null; full_name?: string | null; avatar_url?: string | null } | null
}

type AccessState = {
  document: { id: string; title: string }
  owner?: { id: string; email?: string | null; full_name?: string | null; avatar_url?: string | null } | null
  isOwner: boolean
  hasAccess: boolean
  role: string | null
  latestRequest: AccessRequestItem | null
  pendingRequests: AccessRequestItem[]
  /** True for document owner and for members with the admin role (approve requests, manage Share). */
  canModerateAccessRequests?: boolean
}

type VersionEntry = {
  id: string
  document_id: string
  yjs_state: string
  created_by: string | null
  label: string | null
  created_at: string
  profiles?: { email?: string | null; full_name?: string | null; avatar_url?: string | null } | null
}

type CommentsResponse = {
  role: string
  can_comment: boolean
  can_moderate: boolean
  comments: CommentItem[]
}

const TEMPLATE_CONTENT: Record<string, string> = {
  meeting:
    '<h1>Meeting Notes</h1><p>Date:</p><p>Attendees:</p><h2>Agenda</h2><p></p><h2>Discussion</h2><p></p><h2>Action Items</h2><ul><li></li></ul>',
  blog:
    '<h1>Blog Post</h1><p><em>Introduction</em></p><h2>Main ideas</h2><p></p><h2>Conclusion</h2><p></p>',
  resume:
    '<h1>Your Name</h1><p>Role or headline</p><h2>Experience</h2><p></p><h2>Education</h2><p></p><h2>Skills</h2><p></p>',
  proposal:
    '<h1>Product requirements</h1><h2>Problem</h2><p></p><h2>Goals</h2><p></p><h2>Scope</h2><p></p><h2>Timeline</h2><ol><li></li></ol><h2>Owners</h2><p></p>',
  report:
    '<h1>Report</h1><h2>Summary</h2><ul><li></li></ul><h2>Metrics</h2><p></p><h2>Next steps</h2><p></p>',
}

const TEMPLATE_LABELS: Record<string, string> = {
  meeting: 'Meeting notes',
  blog: 'Blog post',
  resume: 'Resume',
  proposal: 'Product requirements',
  report: 'Report',
}

const FONT_OPTIONS = [
  { label: 'Editorial serif', value: 'Newsreader, Georgia, serif' },
  { label: 'Classic serif', value: 'Georgia, serif' },
  { label: 'Clean sans', value: 'Inter, system-ui, sans-serif' },
  { label: 'Mono notes', value: '"Space Grotesk", monospace' },
]

const COLOR_OPTIONS = [
  { label: 'Ink', value: '#201a13' },
  { label: 'Walnut', value: '#9a5b2b' },
  { label: 'Pine', value: '#2f6b4f' },
  { label: 'Plum', value: '#6e4aa3' },
  { label: 'Brick', value: '#a33a2b' },
  { label: 'Slate', value: '#4f6b8a' },
]

const ZOOM_OPTIONS = [90, 100, 110, 125, 140]
const ROLE_OPTIONS = ['viewer', 'commenter', 'editor', 'admin'] as const
const EDITABLE_ROLES = new Set(['owner', 'editor', 'admin'])
const COMMENTABLE_ROLES = new Set(['owner', 'editor', 'admin', 'commenter'])
const COMMENT_MODERATE_ROLES = new Set(['owner', 'editor', 'admin'])

const warmTheme = {
  background: 'linear-gradient(180deg, #f8f4ec 0%, #f1eadf 100%)',
  panel: 'rgba(255, 252, 247, 0.88)',
  panelStrong: '#fffdfa',
  panelSoft: '#faf5ee',
  border: '#e6dbc9',
  borderStrong: '#d8c5ac',
  text: '#201a13',
  muted: '#6f6254',
  accent: '#9a5b2b',
  accentSoft: '#f2e5d3',
  accentStrong: 'linear-gradient(135deg, #c7894d 0%, #9a5b2b 100%)',
  success: '#2f6b4f',
  error: '#a33a2b',
  paper: '#fffdf9',
  paperEdge: '#efe2cf',
}

const editorThemeStyles = {
  background: warmTheme.background,
  color: warmTheme.text,
  '--color-background': '#f8f4ec',
  '--color-primary': warmTheme.accent,
  '--color-primary-container': warmTheme.accentSoft,
  '--color-secondary': warmTheme.success,
  '--color-on-surface': warmTheme.text,
  '--color-on-surface-variant': warmTheme.muted,
  '--color-outline-variant': warmTheme.borderStrong,
  '--color-error': warmTheme.error,
  '--gradient-primary': warmTheme.accentStrong,
  '--glass-border': warmTheme.border,
} as CSSProperties

function formatRelativeTime(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'Just now'
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} min ago`
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))} hr ago`
  return `${Math.max(1, Math.floor(diff / day))} day ago`
}

export function Editor({ documentId }: { documentId: string }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user)
    })
  }, [])

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[linear-gradient(180deg,#f8f4ec_0%,#f1eadf_100%)]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-[20px] shadow-[0_16px_40px_rgba(154,91,43,0.24)]" style={{ background: warmTheme.accentStrong }}>
            <SafeIcon icon={Loader2} className="h-5 w-5 animate-spin text-white" />
          </div>
          <p className="text-sm text-[#6f6254]">Loading editor...</p>
        </div>
      </div>
    )
  }

  return <EditorInner documentId={documentId} user={user} />
}

function EditorInner({ documentId, user }: { documentId: string; user: User }) {
  const searchParams = useSearchParams()
  const template = searchParams.get('template') || ''

  const [profileRow, setProfileRow] = useState<{ full_name: string | null; avatar_url: string | null; color: string | null } | null>(null)
  const [docTitle, setDocTitle] = useState('Untitled document')
  const [draftTitle, setDraftTitle] = useState('Untitled document')
  const [editingTitle, setEditingTitle] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('saved')
  const [wordCount, setWordCount] = useState(0)
  const [showOutline, setShowOutline] = useState(true)
  const [showVersionPanel, setShowVersionPanel] = useState(false)
  const [showCommentsPanel, setShowCommentsPanel] = useState(false)
  const [headings, setHeadings] = useState<OutlineHeading[]>([])
  const [members, setMembers] = useState<ShareMember[]>([])
  const [shareLoadError, setShareLoadError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState('')
  const [zoom, setZoom] = useState(100)
  const [toolbarFont, setToolbarFont] = useState(FONT_OPTIONS[0].value)
  const [toolbarColor, setToolbarColor] = useState(COLOR_OPTIONS[0].value)
  const [accessState, setAccessState] = useState<AccessState | null>(null)
  const [accessLoading, setAccessLoading] = useState(true)
  const [requestingAccess, setRequestingAccess] = useState(false)
  const [requestRole, setRequestRole] = useState('editor')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null)
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [snapshotSaving, setSnapshotSaving] = useState(false)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [addingComment, setAddingComment] = useState(false)
  const [commentActionId, setCommentActionId] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentDraft, setEditingCommentDraft] = useState('')

  const titleRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const templateApplied = useRef(false)
  const approvalHandled = useRef(false)
  const previousAccessGranted = useRef<boolean | null>(null)
  const isConnectedRef = useRef(false)
  const initialLoadDoneRef = useRef(false)

  useEffect(() => {
    createClient()
      .from('profiles')
      .select('full_name, avatar_url, color')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfileRow(data)
      })
  }, [user.id])

  const userForCollab = useMemo(
    () => ({
      ...user,
      user_metadata: {
        ...user.user_metadata,
        full_name: profileRow?.full_name ?? user.user_metadata?.full_name,
        avatar_url: profileRow?.avatar_url ?? user.user_metadata?.avatar_url,
        color: profileRow?.color ?? user.user_metadata?.color,
      },
    }),
    [profileRow, user]
  )

  const { ydoc, awareness, activeUsers, isConnected, syncRejectMessage, sessionColor } = useCollabEditor(documentId, userForCollab)

  useEffect(() => {
    isConnectedRef.current = isConnected
  }, [isConnected])

  // Must be referentially stable across ordinary re-renders (toolbar color/font, etc.).
  // If this array is recreated every render, TipTap calls setOptions() with new
  // extension instances, which can reinitialize the collaborative doc and wipe text.
  const tiptapExtensions = useMemo(
    () => [
      StarterKit.configure({ undoRedo: false }),
      ...editorExtensions,
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider: { awareness } as never,
        user: {
          name: userForCollab.user_metadata?.full_name || userForCollab.email?.split('@')[0] || 'Writer',
          color: sessionColor || userForCollab.user_metadata?.color || '#9a5b2b',
        },
      }),
    ],
    [ydoc, awareness, sessionColor, userForCollab]
  )

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: tiptapExtensions,
      editorProps: {
        attributes: {
          class:
            'ProseMirror canvas-prose min-h-[calc(100vh-240px)] px-6 py-8 text-[17px] leading-[1.85] outline-none sm:px-12 sm:py-10',
        },
      },
      onUpdate: ({ editor: currentEditor }) => {
        const text = currentEditor.getText()
        setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0)
        const nextHeadings: OutlineHeading[] = []
        currentEditor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'heading') {
            nextHeadings.push({ text: node.textContent || 'Untitled section', level: node.attrs.level || 1, pos })
          }
        })
        setHeadings(nextHeadings)
        setSaveStatus('saving')
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => setSaveStatus(isConnectedRef.current ? 'saved' : 'offline'), 1200)
        if (snapshotTimer.current) clearTimeout(snapshotTimer.current)
        snapshotTimer.current = setTimeout(() => {
          void saveVersionSnapshot('Auto-save')
        }, 15000)
      },
    },
    // Only ydoc/awareness: recreating the editor destroys the ProseMirror view and can corrupt Yjs sync.
    // Cursor name/color and profile fields belong in `tiptapExtensions` via useMemo, not here.
    [ydoc, awareness]
  )

  const templateLabel = TEMPLATE_LABELS[template] || 'General document'
  const readingTime = Math.max(1, Math.ceil(wordCount / 220))
  const pageScale = zoom / 100
  const visibleCollaborators = members.filter((member) => member.user_id !== user.id)
  const collaboratorPresence = activeUsers.filter((activeUser: { id?: string }) => activeUser.id !== user.id)
  const hasDocumentAccess = accessState?.hasAccess ?? true
  const canEditDocument = EDITABLE_ROLES.has(accessState?.role ?? '')
  const canComment = hasDocumentAccess && COMMENTABLE_ROLES.has(accessState?.role ?? '')
  const canModerateComments = hasDocumentAccess && COMMENT_MODERATE_ROLES.has(accessState?.role ?? '')
  const ownerName = accessState?.owner?.full_name || accessState?.owner?.email || 'the document owner'
  const canModerateAccessRequests = Boolean(
    accessState?.canModerateAccessRequests ?? (accessState?.isOwner || accessState?.role === 'admin')
  )

  const loadAccessState = useCallback(async () => {
    try {
      // Only show full loading overlay on the very first access check, not on background re-polls
      if (previousAccessGranted.current === null) {
        setAccessLoading(true)
      }
      const response = await fetch(`/api/documents/${documentId}/access`, { cache: 'no-store' })
      const data = await readResponsePayload<AccessState>(response)

      if (!response.ok) {
        setStatusError(getResponseErrorMessage(data, 'Unable to load document access.'))
        return
      }
      if (!data) {
        setStatusError('Unable to load document access.')
        return
      }

      const wasAccessGranted = previousAccessGranted.current
      previousAccessGranted.current = data.hasAccess

      setAccessState(data)
      setDocTitle(data.document.title)
      setDraftTitle(data.document.title)

      if (wasAccessGranted === false && data.hasAccess && data.latestRequest?.status === 'approved' && !approvalHandled.current) {
        approvalHandled.current = true
        notify.success('Access approved. Refreshing the document...')
        setTimeout(() => window.location.reload(), 700)
      }
    } catch {
      setStatusError('Unable to load document access.')
    } finally {
      setAccessLoading(false)
    }
  }, [documentId])

  const loadMembers = useCallback(async () => {
    if (!hasDocumentAccess) {
      setMembers([])
      return
    }

    try {
      setShareLoadError(null)
      const response = await fetch(`/api/documents/${documentId}/share`)
      const data = await readResponsePayload<ShareMember[]>(response)
      if (!response.ok) {
        setMembers([])
        setShareLoadError(getResponseErrorMessage(data, 'Unable to load collaborators.'))
        return
      }
      setMembers(Array.isArray(data) ? data : [])
    } catch {
      setMembers([])
      setShareLoadError('Could not load sharing settings.')
    }
  }, [documentId, hasDocumentAccess])

  const loadVersions = useCallback(async () => {
    if (!hasDocumentAccess) return

    try {
      setHistoryLoading(true)
      setHistoryError('')
      const response = await fetch(`/api/documents/${documentId}/versions`, { cache: 'no-store' })
      const data = await readResponsePayload<VersionEntry[]>(response)
      if (!response.ok) {
        setVersions([])
        setHistoryError(getResponseErrorMessage(data, 'Unable to load version history.'))
        return
      }
      setVersions(Array.isArray(data) ? data : [])
    } catch {
      setHistoryError('Unable to load version history.')
      setVersions([])
    } finally {
      setHistoryLoading(false)
    }
  }, [documentId, hasDocumentAccess])

  const loadComments = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!hasDocumentAccess) {
      setComments([])
      setCommentsError('')
      return
    }

    try {
      if (!silent) setCommentsLoading(true)
      setCommentsError('')
      const response = await fetch(`/api/documents/${documentId}/comments`, { cache: 'no-store' })
      const data = await readResponsePayload<CommentsResponse>(response)
      if (!response.ok) {
        if (!silent) setComments([])
        setCommentsError(getResponseErrorMessage(data, 'Unable to load comments.'))
        return
      }
      const nextComments = Array.isArray(data?.comments) ? data.comments : []
      setComments(nextComments)
    } catch {
      if (!silent) setComments([])
      setCommentsError('Unable to load comments.')
    } finally {
      if (!silent) setCommentsLoading(false)
    }
  }, [documentId, hasDocumentAccess])

  useEffect(() => {
    void loadAccessState()
  }, [loadAccessState])

  useEffect(() => {
    if (!accessState) return
    if (initialLoadDoneRef.current) return
    initialLoadDoneRef.current = true
    void Promise.all([loadMembers(), loadComments()])
  }, [accessState, loadMembers, loadComments])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(hasDocumentAccess && canEditDocument)
  }, [editor, hasDocumentAccess, canEditDocument])

  useEffect(() => {
    if (!editor) return

    const syncToolbarState = () => {
      const attrs = editor.getAttributes('textStyle') as { fontFamily?: string | null; color?: string | null }
      setToolbarFont(attrs.fontFamily || FONT_OPTIONS[0].value)
      setToolbarColor(attrs.color || COLOR_OPTIONS[0].value)
    }

    syncToolbarState()
    editor.on('selectionUpdate', syncToolbarState)

    return () => {
      editor.off('selectionUpdate', syncToolbarState)
    }
  }, [editor])

  useEffect(() => {
    if (!accessState?.hasAccess || !editor || templateApplied.current || !template || !TEMPLATE_CONTENT[template]) return

    const timer = setTimeout(() => {
      if (!editor || editor.getText().trim()) return
      templateApplied.current = true
      editor.commands.setContent(TEMPLATE_CONTENT[template])
    }, 900)

    return () => clearTimeout(timer)
  }, [editor, template, accessState?.hasAccess])

  useEffect(() => {
    setSaveStatus(isConnected ? 'saved' : 'offline')
  }, [isConnected])

  useEffect(() => {
    if (!showVersionPanel) return
    void loadVersions()
  }, [showVersionPanel, loadVersions])

  useEffect(() => {
    if (!accessState || accessState.isOwner) return
    if (!accessState.hasAccess) return
    if (!accessState.role || accessState.role === 'owner') return
    if (!ROLE_OPTIONS.includes(accessState.role as (typeof ROLE_OPTIONS)[number])) return
    if (accessState.latestRequest?.status === 'pending') return
    setRequestRole(accessState.role)
  }, [accessState])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`doc-access-${documentId}-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'document_members', filter: `document_id=eq.${documentId}` },
        () => {
          void Promise.all([loadAccessState(), loadMembers()])
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'document_access_requests', filter: `document_id=eq.${documentId}` },
        () => {
          void loadAccessState()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'document_comments', filter: `document_id=eq.${documentId}` },
        () => {
          void loadComments({ silent: true })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [documentId, user.id, loadAccessState, loadMembers, loadComments])

  useEffect(() => {
    if (!accessState) return
    const shouldPoll =
      accessState.isOwner ||
      accessState.role === 'admin' ||
      !accessState.hasAccess ||
      accessState.latestRequest?.status === 'pending'
    if (!shouldPoll) return
    const timer = setInterval(() => {
      void loadAccessState()
    }, 12000)
    return () => clearInterval(timer)
  }, [accessState, loadAccessState])

  // Silent polling fallback for comments — catches any events the Supabase
  // real-time channel misses during reconnection. Uses silent mode so the
  // panel never shows a loading spinner during background refreshes.
  useEffect(() => {
    if (!hasDocumentAccess) return
    const timer = setInterval(() => {
      void loadComments({ silent: true })
    }, 30000)
    return () => clearInterval(timer)
  }, [hasDocumentAccess, loadComments])

  useEffect(() => {
    if (!editingCommentId) return
    const exists = comments.some((comment) => comment.id === editingCommentId)
    if (exists) return
    setEditingCommentId(null)
    setEditingCommentDraft('')
  }, [editingCommentId, comments])

  // The toolbar invokes many chain variations, so a narrow local type is more cumbersome than helpful here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runCommand = (command: (chain: any) => any) => {
    if (!editor || !hasDocumentAccess || !canEditDocument) return
    command(editor.chain().focus()).run()
  }

  const saveTitle = async () => {
    if (!accessState?.isOwner) return
    const nextTitle = draftTitle.trim() || 'Untitled document'
    const { error } = await createClient().from('documents').update({ title: nextTitle }).eq('id', documentId)
    if (error) {
      notify.error(error.message)
      return
    }
    setDocTitle(nextTitle)
    setDraftTitle(nextTitle)
    setEditingTitle(false)
  }

  const inviteMember = async (
    invitedUser: { id: string; email: string; full_name?: string | null; avatar_url?: string | null },
    role: string
  ) => {
    setStatusError('')
    const response = await fetch(`/api/documents/${documentId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: invitedUser.id, role }),
    })
    const data = await readResponsePayload(response)
    if (!response.ok) {
      throw new Error(getResponseErrorMessage(data, 'Failed to share document'))
    }
    setMembers((current) => {
      const existing = current.find((member) => member.user_id === invitedUser.id)
      const nextProfile = { email: invitedUser.email, full_name: invitedUser.full_name || undefined, avatar_url: invitedUser.avatar_url || undefined }
      if (existing) {
        return current.map((member) => (member.user_id === invitedUser.id ? { ...member, role, profiles: member.profiles || nextProfile } : member))
      }
      return [{ id: `${invitedUser.id}-${role}`, user_id: invitedUser.id, role, profiles: nextProfile }, ...current]
    })
    await loadAccessState()
  }

  const updateMemberRole = async (memberUserId: string, role: string) => {
    setStatusError('')
    const response = await fetch(`/api/documents/${documentId}/share`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: memberUserId, role }),
    })
    const data = await readResponsePayload<ShareMember>(response)
    if (!response.ok) {
      throw new Error(getResponseErrorMessage(data, 'Failed to update role'))
    }

    setMembers((current) =>
      current.map((member) =>
        member.user_id === memberUserId
          ? {
              ...member,
              role,
            }
          : member
      )
    )
    await Promise.all([loadAccessState(), loadMembers()])
  }

  const revokeMemberAccess = async (memberUserId: string) => {
    setStatusError('')
    const response = await fetch(`/api/documents/${documentId}/share?user_id=${encodeURIComponent(memberUserId)}`, {
      method: 'DELETE',
    })
    const data = await readResponsePayload(response)
    if (!response.ok) {
      throw new Error(getResponseErrorMessage(data, 'Failed to revoke access'))
    }

    setMembers((current) => current.filter((member) => member.user_id !== memberUserId))
    await Promise.all([loadAccessState(), loadMembers()])
  }

  const exportPlainText = () => {
    const blob = new Blob([editor?.getText() || ''], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${docTitle}.txt`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const exportMarkdown = () => {
    if (!editor) return
    let markdown = ''
    editor.state.doc.forEach((node) => {
      if (node.type.name === 'heading') markdown += `${'#'.repeat(node.attrs.level || 1)} ${node.textContent}\n\n`
      if (node.type.name === 'paragraph') markdown += `${node.textContent}\n\n`
      if (node.type.name === 'bulletList') {
        node.forEach((item) => {
          markdown += `- ${item.textContent}\n`
        })
        markdown += '\n'
      }
      if (node.type.name === 'orderedList') {
        let index = 1
        node.forEach((item) => {
          markdown += `${index}. ${item.textContent}\n`
          index += 1
        })
        markdown += '\n'
      }
      if (node.type.name === 'blockquote') markdown += `> ${node.textContent}\n\n`
      if (node.type.name === 'codeBlock') markdown += `\`\`\`\n${node.textContent}\n\`\`\`\n\n`
      if (node.type.name === 'horizontalRule') markdown += `---\n\n`
      if (node.type.name === 'imageBlock') markdown += `![${node.attrs.alt || 'Image'}](${node.attrs.src})\n\n`
    })
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${docTitle}.md`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const saveVersionSnapshot = async (label: string) => {
    if (!hasDocumentAccess) return
    try {
      setSnapshotSaving(true)
      const response = await fetch(`/api/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, yjs_state: uint8ArrayToBase64(Y.encodeStateAsUpdate(ydoc)) }),
      })
      const data = await readResponsePayload(response)
      if (!response.ok) {
        setHistoryError(getResponseErrorMessage(data, 'Unable to save snapshot.'))
        return
      }
      if (showVersionPanel) await loadVersions()
    } catch {
      setHistoryError('Unable to save snapshot.')
    } finally {
      setSnapshotSaving(false)
    }
  }

  const restoreVersion = async (versionId: string) => {
    if (!editor || !hasDocumentAccess) return
    const version = versions.find((item) => item.id === versionId)
    if (!version?.yjs_state) return
    try {
      const snapshotDoc = new Y.Doc()
      Y.applyUpdate(snapshotDoc, base64ToUint8Array(version.yjs_state))
      // Y.XmlFragment.toString() is not HTML — feeding it to setContent corrupts structure.
      // Convert via the same Yjs ↔ ProseMirror bridge TipTap Collaboration uses (fragment field: "default").
      const pmDocJson = yDocToProsemirrorJSON(snapshotDoc, 'default')
      editor.commands.setContent(pmDocJson, { emitUpdate: true })
      notify.success('Snapshot restored into the current draft.')
    } catch {
      notify.error('That snapshot could not be restored.')
    }
  }

  const jumpToHeading = (pos: number) => {
    if (!editor) return
    const { state, view } = editor
    const resolved = state.doc.resolve(Math.min(Math.max(pos + 1, 1), state.doc.content.size))
    const selection = TextSelection.near(resolved)
    view.dispatch(state.tr.setSelection(selection).scrollIntoView())
    view.focus()
  }

  const setLink = () => {
    if (!editor || !hasDocumentAccess || !canEditDocument) return
    const previousUrl = (editor.getAttributes('link') as { href?: string }).href || ''
    const url = window.prompt('Paste a link URL', previousUrl)
    if (url === null) return
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  const clearLink = () => {
    if (!editor || !hasDocumentAccess || !canEditDocument) return
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
  }

  const handleImageSelected = (event: ChangeEvent<HTMLInputElement>) => {
    if (!editor || !hasDocumentAccess || !canEditDocument) return
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setStatusError('Please choose an image file.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      editor.chain().focus().setImageBlock({ src: reader.result, alt: file.name, title: file.name }).run()
    }
    reader.readAsDataURL(file)
  }

  const requestAccess = async () => {
    setRequestingAccess(true)
    setStatusError('')
    try {
      const response = await fetch(`/api/documents/${documentId}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested_role: requestRole }),
      })
      const data = await readResponsePayload(response)
      if (!response.ok) {
        setStatusError(getResponseErrorMessage(data, 'Unable to send access request.'))
        return
      }
      notify.success(
        hasDocumentAccess
          ? `Role change request sent — the owner and admins will see it in their notifications.`
          : `Access request sent — the owner and admins will see it in their notifications.`
      )
      await loadAccessState()
      setNotificationsOpen(false)
    } catch {
      setStatusError('Unable to send access request.')
    } finally {
      setRequestingAccess(false)
    }
  }

  const decideAccessRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    setApprovingRequestId(requestId)
    setStatusError('')
    try {
      const response = await fetch(`/api/documents/${documentId}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, status }),
      })
      const data = await readResponsePayload(response)
      if (!response.ok) {
        setStatusError(getResponseErrorMessage(data, 'Unable to update request.'))
        return
      }
      await Promise.all([loadAccessState(), loadMembers()])
      notify.success(status === 'approved' ? 'Access granted.' : 'Access request declined.')
    } catch {
      setStatusError('Unable to update request.')
    } finally {
      setApprovingRequestId(null)
    }
  }

  const getSelectionPreview = () => {
    if (!editor || editor.state.selection.empty) return ''
    return editor.state.doc
      .textBetween(editor.state.selection.from, editor.state.selection.to, ' ', ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 400)
  }

  const createComment = async () => {
    if (!hasDocumentAccess || !canComment) return
    const content = commentDraft.trim()
    if (!content) return

    setAddingComment(true)
    setCommentsError('')
    try {
      const response = await fetch(`/api/documents/${documentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          selection_text: getSelectionPreview(),
        }),
      })
      const data = await readResponsePayload<CommentItem>(response)
      if (!response.ok) {
        setCommentsError(getResponseErrorMessage(data, 'Unable to add comment.'))
        return
      }
      if (data) {
        setComments((current) => [data, ...current.filter((comment) => comment.id !== data.id)])
      }
      setCommentDraft('')
    } catch {
      setCommentsError('Unable to add comment.')
    } finally {
      setAddingComment(false)
    }
  }

  const updateComment = async (commentId: string, payload: Record<string, string>) => {
    setCommentActionId(commentId)
    setCommentsError('')
    try {
      const response = await fetch(`/api/documents/${documentId}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId, ...payload }),
      })
      const data = await readResponsePayload<CommentItem>(response)
      if (!response.ok) {
        setCommentsError(getResponseErrorMessage(data, 'Unable to update comment.'))
        return null
      }
      if (data) {
        setComments((current) => current.map((comment) => (comment.id === commentId ? data : comment)))
      }
      return data
    } catch {
      setCommentsError('Unable to update comment.')
      return null
    } finally {
      setCommentActionId(null)
    }
  }

  const toggleCommentStatus = async (comment: CommentItem) => {
    const nextStatus = comment.status === 'open' ? 'resolved' : 'open'
    const updated = await updateComment(comment.id, { status: nextStatus })
    if (!updated) return
    notify.success(nextStatus === 'resolved' ? 'Comment resolved.' : 'Comment reopened.')
  }

  const startEditingComment = (comment: CommentItem) => {
    setEditingCommentId(comment.id)
    setEditingCommentDraft(comment.content)
  }

  const cancelEditingComment = () => {
    setEditingCommentId(null)
    setEditingCommentDraft('')
  }

  const saveEditedComment = async () => {
    if (!editingCommentId) return
    const content = editingCommentDraft.trim()
    if (!content) {
      setCommentsError('Comment content cannot be empty.')
      return
    }

    const updated = await updateComment(editingCommentId, { content })
    if (!updated) return
    setEditingCommentId(null)
    setEditingCommentDraft('')
    notify.success('Comment updated.')
  }

  const deleteComment = async (commentId: string) => {
    setCommentActionId(commentId)
    setCommentsError('')
    try {
      const response = await fetch(`/api/documents/${documentId}/comments?comment_id=${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
      })
      const data = await readResponsePayload(response)
      if (!response.ok) {
        setCommentsError(getResponseErrorMessage(data, 'Unable to delete comment.'))
        return
      }
      setComments((current) => current.filter((comment) => comment.id !== commentId))
      if (editingCommentId === commentId) {
        setEditingCommentId(null)
        setEditingCommentDraft('')
      }
      notify.success('Comment deleted.')
    } catch {
      setCommentsError('Unable to delete comment.')
    } finally {
      setCommentActionId(null)
    }
  }

  const saveBadge = (() => {
    if (accessLoading && !accessState) {
      return {
        label: 'Connecting',
        icon: <SafeIcon icon={Loader2} className="h-3.5 w-3.5 animate-spin" />,
        color: warmTheme.accent,
        background: 'rgba(199,137,77,0.12)',
        borderColor: 'rgba(199,137,77,0.24)',
        tooltip: 'Connecting to document…',
      }
    }
    if (statusError || syncRejectMessage) {
      return {
        label: 'Connection issue',
        icon: <SafeIcon icon={WifiOff} className="h-3.5 w-3.5" />,
        color: warmTheme.error,
        background: 'rgba(163,58,43,0.1)',
        borderColor: 'rgba(163,58,43,0.16)',
        tooltip: statusError || syncRejectMessage || '',
      }
    }
    return {
      label: saveStatus === 'saving' ? 'Saving' : saveStatus === 'offline' ? 'Offline' : 'Saved',
      icon: saveStatus === 'saving' ? <SafeIcon icon={Loader2} className="h-3.5 w-3.5 animate-spin" /> : <SafeIcon icon={Check} className="h-3.5 w-3.5" />,
      color: saveStatus === 'offline' ? warmTheme.error : saveStatus === 'saving' ? warmTheme.accent : warmTheme.success,
      background: saveStatus === 'offline' ? 'rgba(163,58,43,0.1)' : saveStatus === 'saving' ? 'rgba(199,137,77,0.12)' : 'rgba(47,107,79,0.1)',
      borderColor: saveStatus === 'offline' ? 'rgba(163,58,43,0.16)' : saveStatus === 'saving' ? 'rgba(199,137,77,0.24)' : 'rgba(47,107,79,0.16)',
      tooltip: null,
    }
  })()

  const initials =
    user.user_metadata?.full_name
      ?.split(' ')
      .map((name: string) => name[0])
      .join('')
      .toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    'U'
  const avatarUrl = user.user_metadata?.avatar_url

  const versionHistoryItems = versions.map((version) => ({
    id: version.id,
    label: version.label || 'Snapshot',
    description: `Captured ${formatRelativeTime(version.created_at)} from the live collaborative canvas.`,
    author: version.profiles?.full_name || version.profiles?.email || 'Momentum AI',
    time: formatRelativeTime(version.created_at),
  }))

  return (
    <div className="relative flex h-screen flex-col overflow-hidden" style={editorThemeStyles}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 left-[18%] h-64 w-64 rounded-full bg-[#f0dfc9]/70 blur-3xl" />
        <div className="absolute right-[-6%] top-[24%] h-80 w-80 rounded-full bg-[#f4e9da]/70 blur-3xl" />
        <div className="absolute bottom-[-8%] left-[42%] h-72 w-72 rounded-full bg-[#eadac6]/55 blur-3xl" />
      </div>

      <header
        className="relative z-40 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6"
        style={{ background: 'rgba(252,248,242,0.9)', borderColor: warmTheme.border, backdropFilter: 'blur(18px)' }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="group flex shrink-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[18px] shadow-[0_14px_32px_rgba(154,91,43,0.18)] transition-transform group-hover:-translate-y-0.5" style={{ background: warmTheme.accentStrong }}>
              <SafeIcon icon={FileText} className="h-5 w-5 text-white" />
            </div>
            <div className="hidden pr-2 sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#998b7d]">Momentum AI</p>
              <p className="text-sm font-semibold text-[#201a13]">Writing studio</p>
            </div>
          </Link>
          <div className="hidden h-8 w-px sm:block" style={{ background: warmTheme.border }}></div>

          <div className="min-w-0 pl-1">
            {editingTitle && accessState?.isOwner ? (
              <input
                ref={titleRef}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={saveTitle}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') saveTitle()
                  if (event.key === 'Escape') {
                    setDraftTitle(docTitle)
                    setEditingTitle(false)
                  }
                }}
                className="w-full min-w-[180px] rounded-xl border border-[#dcc9b3] bg-[#fffdf9] px-3 py-2 text-base font-semibold outline-none"
                style={{ color: warmTheme.text }}
              />
            ) : accessState?.isOwner ? (
              <button
                type="button"
                onClick={() => {
                  setEditingTitle(true)
                  setTimeout(() => titleRef.current?.select(), 50)
                }}
                className="max-w-[44vw] truncate rounded-xl px-3 py-2 text-left text-base font-semibold transition-colors hover:bg-[#f5ede2] sm:max-w-[32vw]"
                style={{ color: warmTheme.text }}
              >
                {docTitle}
              </button>
            ) : (
              <div className="max-w-[44vw] truncate px-3 py-2 text-base font-semibold text-[#201a13] sm:max-w-[32vw]">{docTitle}</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div
            className="hidden items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold md:flex"
            style={{ background: saveBadge.background, color: saveBadge.color, borderColor: saveBadge.borderColor }}
            title={saveBadge.tooltip ?? undefined}
          >
            {saveBadge.icon}
            <span>{saveBadge.label}</span>
          </div>

          {hasDocumentAccess && !canEditDocument && (
            <div
              className="hidden items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold capitalize md:flex"
              style={{ background: '#fff7ef', color: '#6f6254', borderColor: warmTheme.borderStrong }}
            >
              Read-only ({accessState?.role || 'viewer'})
            </div>
          )}

          {collaboratorPresence.length > 0 && PresenceBar ? <PresenceBar activeUsers={collaboratorPresence} /> : null}

          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen((value) => !value)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-[#f5ede2]"
              style={{ borderColor: warmTheme.border, background: 'rgba(255,253,249,0.72)', color: warmTheme.text }}
              aria-label="Notifications"
            >
              <SafeIcon icon={Bell} className="h-4 w-4" style={{ color: warmTheme.accent }} />
              {(accessState?.pendingRequests.length || 0) > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: warmTheme.accentStrong }}>
                  {accessState?.pendingRequests.length}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[340px] rounded-[24px] border p-3 shadow-[0_30px_70px_rgba(32,26,19,0.16)]" style={{ background: '#fffdfa', borderColor: warmTheme.border }}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#201a13]">Editor notifications</p>
                    <p className="mt-1 text-xs text-[#6f6254]">
                      {canModerateAccessRequests
                        ? 'Pending access and role requests (owner and admins can approve).'
                        : 'Document access updates for this editor.'}
                    </p>
                  </div>
                  <button type="button" onClick={() => setNotificationsOpen(false)} className="rounded-full p-2 transition-colors hover:bg-[#f5ede2]">
                    <SafeIcon icon={X} className="h-4 w-4 text-[#6f6254]" />
                  </button>
                </div>

                {canModerateAccessRequests ? (
                  (accessState?.pendingRequests.length ?? 0) === 0 ? (
                    <div className="rounded-[20px] border border-dashed px-4 py-5 text-sm text-[#6f6254]" style={{ borderColor: warmTheme.borderStrong }}>
                      No pending access requests right now.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(accessState?.pendingRequests ?? []).map((request) => (
                        <div key={request.id} className="rounded-[20px] border px-4 py-3" style={{ borderColor: warmTheme.border, background: warmTheme.panelSoft }}>
                          <div className="flex items-start gap-3">
                            {request.profiles?.avatar_url ? (
                              <img src={request.profiles.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f2e5d3] text-xs font-semibold text-[#9a5b2b]">
                                {(request.profiles?.full_name || request.profiles?.email || 'U').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[#201a13]">{request.profiles?.full_name || request.profiles?.email || 'Unknown user'}</p>
                              <p className="mt-1 text-xs text-[#6f6254]">
                                {request.current_role
                                  ? `Requested role change: ${request.current_role} -> ${request.requested_role}.`
                                  : `Requested ${request.requested_role} access to this document.`}
                              </p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-[#998b7d]">{formatRelativeTime(request.created_at)}</p>
                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void decideAccessRequest(request.id, 'approved')}
                                  disabled={approvingRequestId === request.id}
                                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                                  style={{ background: warmTheme.accentStrong }}
                                >
                                  {approvingRequestId === request.id ? 'Saving...' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void decideAccessRequest(request.id, 'rejected')}
                                  disabled={approvingRequestId === request.id}
                                  className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[#f5ede2]"
                                  style={{ borderColor: warmTheme.border, color: warmTheme.text }}
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="space-y-3 rounded-[20px] border px-4 py-4" style={{ borderColor: warmTheme.border, background: warmTheme.panelSoft }}>
                    <p className="text-sm font-semibold text-[#201a13]">
                      {accessState?.latestRequest?.status === 'pending'
                        ? hasDocumentAccess
                          ? 'Role change request sent'
                          : 'Access request sent'
                        : accessState?.latestRequest?.status === 'approved'
                          ? 'Request approved'
                          : 'No new alerts'}
                    </p>
                    <p className="text-sm leading-6 text-[#6f6254]">
                      {accessState?.latestRequest?.status === 'pending'
                        ? `Your request is waiting for the document owner or an admin to approve it.`
                        : accessState?.latestRequest?.status === 'approved'
                          ? hasDocumentAccess
                            ? `${ownerName} approved your role update request.`
                            : `${ownerName} approved your access request. Refreshing will load the live document.`
                          : 'You will see access updates here when the owner or an admin responds.'}
                    </p>

                    {hasDocumentAccess && accessState?.role !== 'owner' && (
                      <div className="rounded-[16px] border p-3" style={{ borderColor: warmTheme.border, background: '#fffdfa' }}>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#998b7d]">Current role</p>
                        <p className="mt-1 text-sm font-semibold capitalize text-[#201a13]">{accessState?.role || 'viewer'}</p>
                        <div className="mt-3 flex flex-col gap-2">
                          <select
                            value={requestRole}
                            onChange={(event) => setRequestRole(event.target.value)}
                            className="h-10 rounded-full border bg-[#fffdfa] px-3 text-sm font-medium text-[#201a13] outline-none focus:border-[#9a5b2b]"
                            style={{ borderColor: warmTheme.borderStrong }}
                            disabled={requestingAccess}
                          >
                            <option value="viewer">Request viewer role</option>
                            <option value="commenter">Request commenter role</option>
                            <option value="editor">Request editor role</option>
                            <option value="admin">Request admin role</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => void requestAccess()}
                            disabled={
                              requestingAccess ||
                              accessState?.latestRequest?.status === 'pending' ||
                              requestRole === (accessState?.role || '')
                            }
                            className="rounded-full px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                            style={{ background: warmTheme.accentStrong }}
                          >
                            {requestingAccess ? 'Sending request...' : 'Request role change'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setShowVersionPanel((value) => !value)
              if (!showVersionPanel) {
                void loadVersions()
              }
            }}
            className="flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors hover:bg-[#f5ede2]"
            style={{ borderColor: warmTheme.border, color: warmTheme.text, background: 'rgba(255,253,249,0.72)' }}
          >
            <SafeIcon icon={GitBranch} className="h-4 w-4" style={{ color: warmTheme.accent }} />
            <span className="hidden sm:inline">History</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCommentsPanel((value) => !value)}
            className="flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors hover:bg-[#f5ede2]"
            style={{
              borderColor: warmTheme.border,
              color: warmTheme.text,
              background: showCommentsPanel ? 'rgba(242,229,211,0.8)' : 'rgba(255,253,249,0.72)',
            }}
          >
            <SafeIcon icon={MessageSquareQuote} className="h-4 w-4" style={{ color: warmTheme.accent }} />
            <span className="hidden sm:inline">Comments</span>
            <span className="rounded-full bg-[#f2e5d3] px-2 py-0.5 text-[11px] font-semibold text-[#9a5b2b]">{comments.length}</span>
          </button>

          {canModerateAccessRequests && ShareModal ? (
            <ShareModal
              documentId={documentId}
              members={members}
              onInvite={inviteMember}
              onUpdateRole={updateMemberRole}
              onRevokeAccess={revokeMemberAccess}
              loadError={shareLoadError}
            />
          ) : null}

          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full border-2 object-cover shadow-sm" style={{ borderColor: '#fff7ef' }} referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm" style={{ background: warmTheme.accentStrong }}>
              {initials}
            </div>
          )}
        </div>
      </header>

      <div className="relative z-30 border-b px-3 py-3 sm:px-4" style={{ background: 'rgba(255,250,244,0.86)', borderColor: warmTheme.border, backdropFilter: 'blur(18px)' }}>
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-1.5">
          <ToolBtn label={showOutline ? 'Hide outline' : 'Show outline'} icon={showOutline ? <SafeIcon icon={PanelLeftClose} className="h-4 w-4" /> : <SafeIcon icon={PanelRightClose} className="h-4 w-4" />} active={showOutline} onClick={() => setShowOutline((value) => !value)} />
          <ToolbarDivider />
          <ToolSelect label="Font" icon={<SafeIcon icon={Type} className="h-4 w-4" />} value={toolbarFont} onChange={(value) => { setToolbarFont(value); if (!editor) return; if (value === FONT_OPTIONS[0].value) { editor.chain().focus().unsetFontFamily().run(); return } editor.chain().focus().setFontFamily(value).run() }} options={FONT_OPTIONS} />
          <ToolSelect label="Color" icon={<span className="h-3 w-3 rounded-full border" style={{ background: toolbarColor, borderColor: 'rgba(154,91,43,0.18)' }} />} value={toolbarColor} onChange={(value) => { setToolbarColor(value); editor?.chain().focus().setColor(value).run() }} options={COLOR_OPTIONS} />
          <ToolbarDivider />
          <ToolBtn label="Heading 1" icon={<SafeIcon icon={Heading1} className="h-4 w-4" />} active={editor?.isActive('heading', { level: 1 })} onClick={() => runCommand((chain) => chain.toggleHeading({ level: 1 }))} />
          <ToolBtn label="Heading 2" icon={<SafeIcon icon={Heading2} className="h-4 w-4" />} active={editor?.isActive('heading', { level: 2 })} onClick={() => runCommand((chain) => chain.toggleHeading({ level: 2 }))} />
          <ToolBtn label="Heading 3" icon={<SafeIcon icon={Heading3} className="h-4 w-4" />} active={editor?.isActive('heading', { level: 3 })} onClick={() => runCommand((chain) => chain.toggleHeading({ level: 3 }))} />
          <ToolbarDivider />
          <ToolBtn label="Bold" icon={<SafeIcon icon={Bold} className="h-4 w-4" />} active={editor?.isActive('bold')} onClick={() => runCommand((chain) => chain.toggleBold())} />
          <ToolBtn label="Italic" icon={<SafeIcon icon={Italic} className="h-4 w-4" />} active={editor?.isActive('italic')} onClick={() => runCommand((chain) => chain.toggleItalic())} />
          <ToolBtn label="Underline" icon={<SafeIcon icon={UnderlineIcon} className="h-4 w-4" />} active={editor?.isActive('underline')} onClick={() => runCommand((chain) => chain.toggleUnderline())} />
          <ToolBtn label="Strike" icon={<SafeIcon icon={Strikethrough} className="h-4 w-4" />} active={editor?.isActive('strike')} onClick={() => runCommand((chain) => chain.toggleStrike())} />
          <ToolBtn label="Clear formatting" icon={<SafeIcon icon={RemoveFormatting} className="h-4 w-4" />} onClick={() => runCommand((chain) => chain.unsetAllMarks().unsetColor().unsetFontFamily())} />
          <ToolbarDivider />
          <ToolBtn label="Insert link" icon={<SafeIcon icon={Link2} className="h-4 w-4" />} active={editor?.isActive('link')} onClick={setLink} />
          <ToolBtn label="Remove link" text="Unlink" onClick={clearLink} />
          <ToolBtn label="Insert image" icon={<SafeIcon icon={ImagePlus} className="h-4 w-4" />} onClick={() => imageInputRef.current?.click()} />
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
          <ToolbarDivider />
          <ToolBtn label="Bulleted list" icon={<SafeIcon icon={List} className="h-4 w-4" />} active={editor?.isActive('bulletList')} onClick={() => runCommand((chain) => chain.toggleBulletList())} />
          <ToolBtn label="Numbered list" icon={<SafeIcon icon={ListOrdered} className="h-4 w-4" />} active={editor?.isActive('orderedList')} onClick={() => runCommand((chain) => chain.toggleOrderedList())} />
          <ToolBtn label="Quote" icon={<SafeIcon icon={MessageSquareQuote} className="h-4 w-4" />} active={editor?.isActive('blockquote')} onClick={() => runCommand((chain) => chain.toggleBlockquote())} />
          <ToolBtn label="Inline code" icon={<SafeIcon icon={Code2} className="h-4 w-4" />} active={editor?.isActive('code')} onClick={() => runCommand((chain) => chain.toggleCode())} />
          <ToolBtn label="Divider" icon={<SafeIcon icon={Minus} className="h-4 w-4" />} onClick={() => runCommand((chain) => chain.setHorizontalRule())} />
          <ToolbarDivider />
          <ToolBtn label="Export Markdown" icon={<SafeIcon icon={FileDown} className="h-4 w-4" />} text="Markdown" onClick={exportMarkdown} />
          <ToolBtn label="Export text" icon={<SafeIcon icon={FileText} className="h-4 w-4" />} text="Text" onClick={exportPlainText} />
          <ToolbarDivider />
          <ToolSelect label="Zoom" value={String(zoom)} onChange={(value) => setZoom(Number(value))} options={ZOOM_OPTIONS.map((option) => ({ label: `${option}%`, value: String(option) }))} />
          <div className="ml-auto hidden items-center rounded-full border px-3 py-1.5 text-xs font-semibold md:flex" style={{ background: '#fffdfa', color: '#6f6254', borderColor: warmTheme.border }}>
            {wordCount.toLocaleString()} words
          </div>
        </div>
      </div>


      <div className="relative z-10 flex min-h-0 flex-1 gap-3 overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
        {showOutline && (
          <aside className="hidden w-[294px] flex-shrink-0 lg:block">
            <div className="flex h-full flex-col rounded-[30px] border p-4 shadow-[0_24px_48px_rgba(32,26,19,0.06)]" style={{ background: warmTheme.panel, borderColor: warmTheme.border, backdropFilter: 'blur(18px)' }}>
              <div className="mb-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#998b7d]">Document map</p>
                  <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: warmTheme.accentSoft }}>
                    <SafeIcon icon={Clock3} className="h-3 w-3 shrink-0" style={{ color: warmTheme.accent }} />
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color: warmTheme.accent }}>{readingTime} min read</span>
                  </div>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-[#201a13]">Navigate your draft</h2>
                <p className="mt-1 text-sm text-[#6f6254]">Jump between sections and keep your structure in view.</p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {headings.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed px-4 py-5 text-sm italic text-[#998b7d]" style={{ borderColor: warmTheme.borderStrong, background: 'rgba(255,253,249,0.72)' }}>
                    Add headings to see your document outline here.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {headings.map((heading, index) => (
                      <button
                        key={`${heading.text}-${index}`}
                        type="button"
                        onClick={() => jumpToHeading(heading.pos)}
                        className="group relative w-full rounded-[18px] px-3 py-3 text-left transition-transform hover:-translate-y-0.5"
                        style={{ paddingLeft: `${(heading.level - 1) * 14 + 12}px`, background: heading.level === 1 ? '#fffdf9' : 'rgba(255,253,249,0.68)', border: `1px solid ${warmTheme.border}` }}
                      >
                        <span className="absolute left-0 top-4 h-5 w-[3px] rounded-full opacity-0 transition-opacity group-hover:opacity-100" style={{ background: warmTheme.accent }} />
                        <span className="block truncate text-sm font-medium text-[#201a13]">{heading.text}</span>
                        <span className="mt-1 block text-[11px] uppercase tracking-[0.24em] text-[#998b7d]">H{heading.level}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-[24px] border p-4" style={{ background: 'linear-gradient(180deg,#fffdfa_0%,#f7efe4_100%)', borderColor: warmTheme.border }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#998b7d]">Writing pace</p>
                <div className="mt-3 space-y-2 text-sm text-[#6f6254]">
                  <p>{wordCount.toLocaleString()} words in this draft</p>
                  <p>{headings.length} sections mapped</p>
                  <p>{visibleCollaborators.length} collaborators with access</p>
                </div>
              </div>
            </div>
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="min-h-0 flex-1 overflow-y-auto rounded-[36px] border shadow-[0_30px_60px_rgba(32,26,19,0.07)]" style={{ background: 'rgba(247,239,228,0.76)', borderColor: warmTheme.border }}>
            {editor && hasDocumentAccess ? (
              <>
                <div className="mx-auto w-full max-w-[980px] px-3 py-4 sm:px-6 sm:py-5">
                  <div className="rounded-[34px] border p-3 shadow-[0_20px_44px_rgba(32,26,19,0.06)] sm:p-4" style={{ background: warmTheme.paper, borderColor: warmTheme.paperEdge }}>
                    <div className="rounded-[30px] border bg-[#fffdfa] px-2 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:px-4 sm:py-4" style={{ borderColor: warmTheme.paperEdge }}>
                      <div style={{ zoom: pageScale }}>
                        <div className="mx-auto max-w-3xl">
                          {EditorContent ? (
                            <EditorContent editor={editor} />
                          ) : (
                            <div className="rounded-[24px] border px-4 py-5 text-sm text-[#6f6254]" style={{ borderColor: warmTheme.border, background: '#fffdfa' }}>
                              The editor canvas could not be loaded. Refreshing the page should recover it.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : !accessLoading && !hasDocumentAccess ? (
              <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
                <div className="w-full max-w-2xl rounded-[34px] border p-6 shadow-[0_24px_60px_rgba(32,26,19,0.08)] sm:p-8" style={{ background: warmTheme.panelStrong, borderColor: warmTheme.border }}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#998b7d]">Access required</p>
                      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#201a13]">Ask the host to open this document for you.</h2>
                      <p className="mt-3 max-w-xl text-sm leading-7 text-[#6f6254]">
                        This editor is currently blocked because your account is not on the document access list yet. Send a request — the document owner and admins see it in their editor notifications and can approve it.
                      </p>
                    </div>
                    <div className="rounded-[24px] border px-4 py-3" style={{ background: warmTheme.accentSoft, borderColor: warmTheme.border }}>
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#9a5b2b]">
                        <SafeIcon icon={LockKeyhole} className="h-4 w-4" />
                        Locked
                      </div>
                      <p className="mt-1 text-xs text-[#6f6254]">{templateLabel}</p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <select value={requestRole} onChange={(event) => setRequestRole(event.target.value)} className="h-12 rounded-full border bg-[#fffdfa] px-4 text-sm font-medium text-[#201a13] outline-none focus:border-[#9a5b2b]" style={{ borderColor: warmTheme.borderStrong }}>
                      <option value="viewer">Request viewer access</option>
                      <option value="commenter">Request commenter access</option>
                      <option value="editor">Request editor access</option>
                      <option value="admin">Request admin access</option>
                    </select>
                    <button type="button" onClick={() => void requestAccess()} disabled={requestingAccess || accessState?.latestRequest?.status === 'pending'} className="rounded-full px-5 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60" style={{ background: warmTheme.accentStrong }}>
                      {accessState?.latestRequest?.status === 'pending' ? 'Access request sent' : requestingAccess ? 'Sending request...' : 'Request access'}
                    </button>
                  </div>

                  {accessState?.latestRequest && (
                    <div className="mt-5 rounded-[24px] border px-4 py-4" style={{ borderColor: warmTheme.border, background: '#fffdf9' }}>
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#201a13]">
                        {accessState.latestRequest.status === 'approved' ? <SafeIcon icon={CheckCircle2} className="h-4 w-4 text-[#2f6b4f]" /> : <SafeIcon icon={Clock3} className="h-4 w-4 text-[#9a5b2b]" />}
                        {accessState.latestRequest.status === 'pending' ? 'Waiting for approval' : accessState.latestRequest.status === 'approved' ? 'Approved' : 'Request declined'}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#6f6254]">
                        {accessState.latestRequest.status === 'pending'
                          ? `The owner or an admin has your request and can approve it from their editor notifications.`
                          : accessState.latestRequest.status === 'approved'
                            ? 'Refresh this page and the live collaborative canvas will load.'
                            : 'You can send a new request whenever you need access again.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-full items-center justify-center px-4 py-12">
                <div className="space-y-3 w-full max-w-[640px] px-6">
                  <div className="h-3 rounded-full animate-pulse" style={{ background: warmTheme.border, width: '60%' }} />
                  <div className="h-3 rounded-full animate-pulse" style={{ background: warmTheme.border, width: '85%' }} />
                  <div className="h-3 rounded-full animate-pulse" style={{ background: warmTheme.border, width: '72%' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {showCommentsPanel && CommentsPanel ? (
          <CommentsPanel
            comments={comments}
            loading={commentsLoading}
            error={commentsError}
            onClose={() => setShowCommentsPanel(false)}
            currentUserId={user.id}
            canComment={canComment}
            canModerate={canModerateComments}
            draft={commentDraft}
            onDraftChange={setCommentDraft}
            onAddComment={() => void createComment()}
            adding={addingComment}
            actionCommentId={commentActionId}
            editingCommentId={editingCommentId}
            editDraft={editingCommentDraft}
            onEditDraftChange={setEditingCommentDraft}
            onStartEdit={startEditingComment}
            onCancelEdit={cancelEditingComment}
            onSaveEdit={() => void saveEditedComment()}
            onToggleStatus={(comment) => void toggleCommentStatus(comment)}
            onDelete={(commentId) => void deleteComment(commentId)}
          />
        ) : null}

        {showVersionPanel && VersionHistoryPanel ? <VersionHistoryPanel versions={versionHistoryItems} loading={historyLoading} error={historyError} saving={snapshotSaving} onClose={() => setShowVersionPanel(false)} onRestore={(versionId) => void restoreVersion(versionId)} onSaveSnapshot={() => void saveVersionSnapshot('Manual snapshot')} /> : null}
      </div>

      <style>{`
        .collaboration-cursor__caret { border-left: 2px solid; pointer-events: none; position: relative; }
        .collaboration-cursor__label { border-radius: 999px; color: #fff; font-size: 10px; font-weight: 600; left: -1px; padding: 2px 8px; position: absolute; top: -1.6em; user-select: none; white-space: nowrap; }
        .canvas-prose { color: var(--color-on-surface); font-family: 'Newsreader', Georgia, serif; max-width: none; }
        .canvas-prose::selection, .canvas-prose *::selection { background: rgba(199, 137, 77, 0.18); }
        .canvas-prose h1 { font-family: 'Newsreader', Georgia, serif; font-size: 2.35rem; font-weight: 400; letter-spacing: -0.025em; color: var(--color-on-surface); margin-bottom: 0.65em; margin-top: 0; line-height: 1.14; }
        .canvas-prose h2 { font-family: 'Newsreader', Georgia, serif; font-size: 1.65rem; font-weight: 400; letter-spacing: -0.02em; color: var(--color-on-surface); margin-top: 2.45rem; margin-bottom: 0.55em; line-height: 1.26; }
        .canvas-prose h3 { font-family: 'Newsreader', Georgia, serif; font-size: 1.25rem; font-weight: 500; color: var(--color-on-surface); margin-top: 1.9rem; margin-bottom: 0.45em; }
        .canvas-prose p { color: rgba(32, 26, 19, 0.94); line-height: 1.85; margin-bottom: 1.2rem; font-size: 1.12rem; }
        .canvas-prose ul, .canvas-prose ol { padding-left: 1.6rem; color: rgba(32, 26, 19, 0.94); font-size: 1.12rem; line-height: 1.82; margin-bottom: 1.2rem; }
        .canvas-prose li { margin-bottom: 0.45rem; }
        .canvas-prose blockquote { border-left: 3px solid var(--color-primary); padding-left: 1.25rem; color: rgba(111, 98, 84, 0.92); font-style: italic; margin: 1.65rem 0; font-size: 1.08rem; }
        .canvas-prose code { background: rgba(244, 235, 222, 0.92); border-radius: 0.45rem; padding: 0.15rem 0.4rem; font-family: 'Space Grotesk', monospace; font-size: 0.85em; }
        .canvas-prose pre { background: rgba(244, 235, 222, 0.95); border-radius: 1rem; padding: 1rem 1.1rem; overflow-x: auto; font-family: 'Space Grotesk', monospace; margin: 1.5rem 0; line-height: 1.55; font-size: 0.9rem; }
        .canvas-prose pre code { background: none; padding: 0; color: inherit; }
        .canvas-prose hr { border: none; border-top: 1px solid rgba(154, 91, 43, 0.22); margin: 2rem 0; }
        .canvas-prose a { color: var(--color-primary); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
        .canvas-prose img, .editor-image { border: 1px solid rgba(230, 219, 201, 0.95); border-radius: 24px; display: block; height: auto; margin: 1.6rem auto; max-width: 100%; box-shadow: 0 18px 40px rgba(32, 26, 19, 0.08); }
        .editor-image-wrap { margin: 1.6rem 0; }
        .editor-underline { text-decoration-thickness: 2px; text-underline-offset: 3px; }
      `}</style>
    </div>
  )
}

function ToolBtn({ icon, label, text, active, onClick }: { icon?: ReactNode; label: string; text?: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 items-center justify-center gap-1 rounded-full px-3 transition-colors"
      style={{ background: active ? 'rgba(154,91,43,0.12)' : 'transparent', color: active ? warmTheme.accent : warmTheme.muted }}
    >
      {icon}
      {text && <span className="text-xs font-semibold">{text}</span>}
    </button>
  )
}

function ToolSelect({
  icon,
  label,
  value,
  onChange,
  options,
}: {
  icon?: ReactNode
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const selectedOption = options.find((o) => o.value === value)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
        aria-label={label}
        className="flex h-9 items-center gap-2 rounded-full border pl-3 pr-2 text-xs font-semibold hover:bg-[#f5ede2] transition-colors"
        style={{ borderColor: warmTheme.border, background: '#fffdfa', color: warmTheme.text }}
      >
        {icon}
        {selectedOption?.label && <span className="truncate max-w-[120px]">{selectedOption.label}</span>}
        <SafeIcon icon={ChevronDown} className="h-3.5 w-3.5 text-[#998b7d]" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 min-[140px] w-max overflow-y-auto rounded-[16px] border bg-white/95 py-1.5 shadow-[0_16px_40px_rgba(83,67,48,0.12)] backdrop-blur-md" style={{ borderColor: warmTheme.border }}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="flex w-full items-center px-4 py-2 text-left text-xs font-semibold transition-colors hover:bg-[#f6f1e8]"
              style={{ color: value === option.value ? warmTheme.accent : warmTheme.text }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SafeIcon({
  icon: Icon,
  className,
  style,
}: {
  icon?: ElementType<{ className?: string; style?: CSSProperties }>
  className?: string
  style?: CSSProperties
}) {
  return Icon ? <Icon className={className} style={style} /> : null
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-4 w-px" style={{ background: 'rgba(154,91,43,0.2)' }} />
}
