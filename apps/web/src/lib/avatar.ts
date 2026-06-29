import type { User } from '@supabase/supabase-js'

import type { ProfileSummary } from '@/types/project'

const AVATAR_BACKGROUNDS = [
  'linear-gradient(135deg, #0f6cbd 0%, #115ea3 100%)',
  'linear-gradient(135deg, #0b6a6f 0%, #0f888f 100%)',
  'linear-gradient(135deg, #8f4f00 0%, #bc6f00 100%)',
  'linear-gradient(135deg, #5c2e91 0%, #7f56d9 100%)',
  'linear-gradient(135deg, #1f6f43 0%, #2f9b60 100%)',
  'linear-gradient(135deg, #a4262c 0%, #d13438 100%)',
] as const

function normalizeName(value: string | null | undefined) {
  return value?.trim() || null
}

export function displayNameForUser(user: User | null) {
  const fullName =
    normalizeName(user?.user_metadata?.full_name as string | undefined) ||
    normalizeName(user?.user_metadata?.name as string | undefined)
  return fullName || user?.email?.split('@')[0] || 'Momentum User'
}

export function profilePhotoForUser(user: User | null) {
  const metadata = user?.user_metadata as Record<string, unknown> | undefined
  const candidates = [
    metadata?.avatar_url,
    metadata?.picture,
    metadata?.photo_url,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate
  }
  return null
}

export function initialsForName(name: string | null | undefined, email?: string | null) {
  const normalized = normalizeName(name)
  if (normalized) {
    const initials = normalized
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
    if (initials) return initials
  }
  return email?.slice(0, 2).toUpperCase() || 'MU'
}

export function avatarStyleSeed(input: string | null | undefined) {
  const value = input?.trim() || 'momentum-user'
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return AVATAR_BACKGROUNDS[hash % AVATAR_BACKGROUNDS.length]
}

export function profilePhotoForProfile(profile: ProfileSummary | null | undefined) {
  return normalizeName(profile?.avatar_url)
}
