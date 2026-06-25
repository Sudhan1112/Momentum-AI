import { NextResponse } from 'next/server'

import { getMomentumDailyBrief } from '@/lib/momentum/ai/capabilities/morning-brief'
import { requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'

export async function GET() {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const brief = await getMomentumDailyBrief(session.data.user.id)
    return NextResponse.json(brief)
  } catch (error) {
    return jsonMomentumError(error)
  }
}
