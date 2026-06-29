import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const callbackError = searchParams.get('error_description') ?? searchParams.get('error')
  const next = searchParams.get('next') ?? '/'

  if (callbackError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(callbackError)}`)
  }

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const admin = createAdminClient()
        const metadata = user.user_metadata as Record<string, unknown> | undefined
        const fullName =
          (typeof metadata?.full_name === 'string' && metadata.full_name.trim()) ||
          (typeof metadata?.name === 'string' && metadata.name.trim()) ||
          null
        const avatarUrl =
          (typeof metadata?.avatar_url === 'string' && metadata.avatar_url.trim()) ||
          (typeof metadata?.picture === 'string' && metadata.picture.trim()) ||
          (typeof metadata?.photo_url === 'string' && metadata.photo_url.trim()) ||
          null

        await admin.from('profiles').upsert(
          {
            id: user.id,
            email: user.email ?? null,
            full_name: fullName,
            avatar_url: avatarUrl,
          },
          { onConflict: 'id' }
        )
      }

      return NextResponse.redirect(`${origin}${next}`)
    }

    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Missing authentication code. Try signing in again.')}`)
}
