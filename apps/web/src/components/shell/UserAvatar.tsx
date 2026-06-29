'use client'

import type { CSSProperties } from 'react'
import type { User } from '@supabase/supabase-js'

import type { ProfileSummary } from '@/types/project'
import { avatarStyleSeed, displayNameForUser, initialsForName, profilePhotoForProfile, profilePhotoForUser } from '@/lib/avatar'

type UserAvatarProps = {
  user?: User | null
  profile?: ProfileSummary | null
  name?: string | null
  email?: string | null
  size?: 'sm' | 'md' | 'lg'
  rounded?: 'lg' | 'xl' | 'full'
}

const SIZE_CLASS = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
} as const

const ROUNDED_CLASS = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
} as const

export function UserAvatar({
  user = null,
  profile = null,
  name = null,
  email = null,
  size = 'md',
  rounded = 'xl',
}: UserAvatarProps) {
  const resolvedName = name || profile?.full_name || displayNameForUser(user)
  const resolvedEmail = email || profile?.email || user?.email || null
  const photo = profilePhotoForProfile(profile) || profilePhotoForUser(user)
  const fallback = initialsForName(resolvedName, resolvedEmail)
  const style = { background: avatarStyleSeed(resolvedEmail || resolvedName) } as CSSProperties

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={resolvedName || 'User avatar'}
        className={`${SIZE_CLASS[size]} ${ROUNDED_CLASS[rounded]} object-cover`}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div
      className={`flex items-center justify-center font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ${SIZE_CLASS[size]} ${ROUNDED_CLASS[rounded]}`}
      style={style}
      aria-hidden="true"
    >
      {fallback}
    </div>
  )
}
