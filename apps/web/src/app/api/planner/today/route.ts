import { NextResponse } from 'next/server'

import { requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { getPlannerToday } from '@/lib/momentum/planner/planner-service'

export async function GET() {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const planner = await getPlannerToday(session.data.user.id)
    return NextResponse.json(planner)
  } catch (error) {
    return jsonMomentumError(error)
  }
}
