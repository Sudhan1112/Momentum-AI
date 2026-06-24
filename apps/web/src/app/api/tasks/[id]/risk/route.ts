import { NextResponse } from 'next/server'

import { assertTaskAccess, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { getTaskRiskScore, persistTaskRiskScore } from '@/lib/momentum/risk-scorer'

type RouteContext = {
  params: {
    id: string
  }
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const access = await assertTaskAccess(params.id, session.data.user.id)
    if (!access.ok) return access.response

    const risk = await getTaskRiskScore(params.id)
    await persistTaskRiskScore(risk)

    return NextResponse.json(risk)
  } catch (error) {
    return jsonMomentumError(error)
  }
}
