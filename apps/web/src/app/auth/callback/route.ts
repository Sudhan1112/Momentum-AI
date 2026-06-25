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
      return NextResponse.redirect(`${origin}${next}`)
    }

    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Missing authentication code. Try signing in again.')}`)
}
