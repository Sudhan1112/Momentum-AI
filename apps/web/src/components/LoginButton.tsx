'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { Loader2 } from 'lucide-react'

export function LoginButton({
  onClick,
  loading,
  className,
}: {
  onClick?: () => Promise<void>
  loading?: boolean
  className?: string
}) {
  const supabase = createClient()

  const handleLogin = async () => {
    if (onClick) {
      await onClick()
      return
    }
    const redirectTo = `${window.location.origin}/auth/callback`
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    })
  }

  return (
    <Button
      onClick={handleLogin}
      disabled={loading}
      className={cn('flex w-full items-center justify-center gap-2', className)}
      size="lg"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <img src="/brand/google.svg" alt="Google" className="h-5 w-5" />
      )}
      Sign in with Google
    </Button>
  )
}
