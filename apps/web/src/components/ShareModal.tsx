'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Loader2, Search, Share2, X } from 'lucide-react'
import { readResponsePayload } from '@/lib/http'

type Member = {
  id: string
  user_id?: string
  role: string
  profiles?: { email?: string; full_name?: string; avatar_url?: string } | null
}

type UserResult = {
  id: string
  email: string
  full_name?: string | null
  avatar_url?: string | null
}

export function ShareModal({
  documentId,
  members,
  onInvite,
  onUpdateRole,
  onRevokeAccess,
  loadError,
}: {
  documentId: string
  members: Member[]
  onInvite: (user: UserResult, role: string) => Promise<void>
  onUpdateRole: (userId: string, role: string) => Promise<void>
  onRevokeAccess: (userId: string) => Promise<void>
  loadError?: string | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('editor')
  const [results, setResults] = useState<UserResult[]>([])
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const [revokingMemberId, setRevokingMemberId] = useState<string | null>(null)

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    if (query.trim().length < 2) {
      setResults([])
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        })
        const data = await readResponsePayload<UserResult[]>(response)
        if (!response.ok) {
          setResults([])
          return
        }
        setResults(Array.isArray(data) ? data : [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [isOpen, query])

  const shareLink = typeof window === 'undefined' ? `/doc/${documentId}` : `${window.location.origin}/doc/${documentId}`

  const invite = async () => {
    if (!selectedUser) return
    setInviting(true)
    setInviteError('')
    try {
      await onInvite(selectedUser, role)
      setQuery('')
      setRole('editor')
      setSelectedUser(null)
      setResults([])
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to invite collaborator.')
    } finally {
      setInviting(false)
    }
  }

  const updateRole = async (member: Member, nextRole: string) => {
    if (!member.user_id || member.role === 'owner' || member.role === nextRole) return
    setUpdatingMemberId(member.user_id)
    setInviteError('')
    try {
      await onUpdateRole(member.user_id, nextRole)
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to update member role.')
    } finally {
      setUpdatingMemberId(null)
    }
  }

  const revokeAccess = async (member: Member) => {
    if (!member.user_id || member.role === 'owner') return
    setRevokingMemberId(member.user_id)
    setInviteError('')
    try {
      await onRevokeAccess(member.user_id)
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to revoke member access.')
    } finally {
      setRevokingMemberId(null)
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const trigger = (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors hover:bg-[#f5ede2]"
      style={{ borderColor: 'var(--glass-border)', color: 'var(--color-on-surface)', background: 'rgba(255,253,249,0.72)' }}
    >
      <Share2 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
      <span className="hidden sm:inline">Share</span>
    </button>
  )

  const overlay = isOpen ? (
    <div
      className="fixed inset-0 z-[10050] overflow-y-auto p-4 pt-16 sm:pt-24"
      style={{ background: 'rgba(32,26,19,0.38)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="absolute inset-0" aria-hidden onClick={() => setIsOpen(false)} />
      <div className="relative z-[10051] mx-auto w-full max-w-xl rounded-[30px] border p-6 shadow-[0_30px_80px_rgba(32,26,19,0.22)]" style={{ background: '#fffdfa', borderColor: '#e6dbc9' }}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#998b7d]">Momentum AI</p>
            <h3 id="share-modal-title" className="mt-2 text-[28px] font-semibold tracking-tight text-[#201a13]">
              Share document
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#6f6254]">
              Invite the right people, set their role, and keep access visible in one place.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[#f5ede2]"
          >
            <X className="h-5 w-5 text-[#6f6254]" />
          </button>
        </div>

        <div className="rounded-[24px] border p-4" style={{ background: '#faf5ee', borderColor: '#e6dbc9' }}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#998b7d]" />
              <input
                type="text"
                placeholder="Search by name or email"
                className="h-12 w-full rounded-full border border-[#dcc9b3] bg-[#fffdfa] pl-11 pr-4 text-sm text-[#201a13] outline-none transition-colors focus:border-[#9a5b2b]"
                value={selectedUser ? selectedUser.email : query}
                onChange={(event) => {
                  setSelectedUser(null)
                  setQuery(event.target.value)
                }}
              />

              {!selectedUser && (results.length > 0 || searching) && (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[10060] rounded-[22px] border bg-[#fffdfa] py-2 shadow-[0_20px_40px_rgba(32,26,19,0.12)]" style={{ borderColor: '#e6dbc9' }}>
                  {searching ? (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-[#6f6254]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching...
                    </div>
                  ) : (
                    results.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedUser(user)
                          setQuery(user.email)
                          setResults([])
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#faf4eb]"
                      >
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt=""
                            className="h-10 w-10 rounded-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f2e5d3] text-xs font-semibold text-[#9a5b2b]">
                            {(user.full_name || user.email).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#201a13]">{user.full_name || user.email}</p>
                          <p className="truncate text-xs text-[#6f6254]">{user.email}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="h-12 rounded-full border border-[#dcc9b3] bg-[#fffdfa] px-4 text-sm font-medium text-[#201a13] outline-none focus:border-[#9a5b2b]"
            >
              <option value="viewer">Viewer</option>
              <option value="commenter">Commenter</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {selectedUser ? (
            <button
              type="button"
              onClick={invite}
              disabled={inviting}
              className="mt-4 w-full rounded-full bg-[#9a5b2b] hover:bg-[#c7894d] px-5 py-3 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:bg-[#dcc9b3] disabled:text-[#201a13]"
            >
              {inviting ? 'Sending invite...' : 'Send invite'}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="mt-4 w-full rounded-full bg-[#dcc9b3] px-5 py-3 text-sm font-semibold text-[#6f6254] cursor-not-allowed transition-all"
            >
              Send invite
            </button>
          )}
        </div>

        {(loadError || inviteError) && (
          <div className="mt-4 space-y-2">
            {loadError && <p className="rounded-2xl border border-[#eab9b2] bg-[#fff5f3] px-4 py-3 text-sm text-[#a33a2b]">{loadError}</p>}
            {inviteError && <p className="rounded-2xl border border-[#eab9b2] bg-[#fff5f3] px-4 py-3 text-sm text-[#a33a2b]">{inviteError}</p>}
          </div>
        )}

        <div className="mt-5 rounded-[24px] border p-4" style={{ background: '#fffdf9', borderColor: '#e6dbc9' }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#201a13]">People with access</p>
              <p className="mt-1 text-xs text-[#6f6254]">Only real shared members are shown here.</p>
            </div>
            <span className="rounded-full bg-[#f2e5d3] px-3 py-1 text-xs font-semibold text-[#9a5b2b]">
              {members.length}
            </span>
          </div>

          <div className="max-h-[38vh] space-y-2 overflow-y-auto">
            {members.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[#dcc9b3] px-4 py-5 text-sm text-[#6f6254]">
                No collaborators added yet.
              </div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-[20px] border px-3 py-3" style={{ borderColor: '#efe2cf', background: '#faf5ee' }}>
                  <div className="flex min-w-0 items-center gap-3">
                    {member.profiles?.avatar_url ? (
                      <img
                        src={member.profiles.avatar_url}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f2e5d3] text-xs font-semibold text-[#9a5b2b]">
                        {(member.profiles?.full_name || member.profiles?.email || 'U').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#201a13]">{member.profiles?.full_name || member.profiles?.email}</p>
                      <p className="truncate text-xs text-[#6f6254]">{member.profiles?.email || 'No email available'}</p>
                    </div>
                  </div>
                  {member.role === 'owner' || !member.user_id ? (
                    <span className="rounded-full bg-[#fffdfa] px-3 py-1 text-xs font-semibold capitalize text-[#6f6254]">
                      {member.role}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={member.role}
                        onChange={(event) => void updateRole(member, event.target.value)}
                        disabled={updatingMemberId === member.user_id || revokingMemberId === member.user_id}
                        className="h-9 rounded-full border border-[#dcc9b3] bg-[#fffdfa] px-3 text-xs font-medium capitalize text-[#201a13] outline-none focus:border-[#9a5b2b] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="commenter">Commenter</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void revokeAccess(member)}
                        disabled={updatingMemberId === member.user_id || revokingMemberId === member.user_id}
                        className="rounded-full border border-[#dcc9b3] px-3 py-2 text-xs font-semibold text-[#a33a2b] transition-colors hover:bg-[#fff0ed] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {revokingMemberId === member.user_id ? 'Revoking...' : 'Revoke'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition-colors hover:bg-[#f5ede2]"
            style={{ borderColor: '#dcc9b3', color: '#9a5b2b' }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Link copied' : 'Copy link'}
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-full border px-5 py-3 text-sm font-semibold transition-colors hover:bg-[#f5ede2]"
            style={{ borderColor: '#dcc9b3', color: '#201a13' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {trigger}
      {isOpen && mounted && typeof document !== 'undefined' && overlay
        ? createPortal(overlay, document.body)
        : null}
    </>
  )
}
