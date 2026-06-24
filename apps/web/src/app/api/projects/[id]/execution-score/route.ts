import { NextResponse } from 'next/server'

import { assertProjectMember, requireSession } from '@/lib/momentum/authz'
import { getProjectExecutionScore } from '@/lib/momentum/execution-score'
import { calculateWorkspaceHealth } from '@/lib/momentum/health-snapshot'
import { jsonMomentumError } from '@/lib/momentum/errors'

type RouteContext = {
  params: {
    id: string
  }
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const access = await assertProjectMember(params.id, session.data.user.id)
    if (!access.ok) return access.response

    const execution_score = await getProjectExecutionScore(params.id)
    const health = calculateWorkspaceHealth(execution_score)

    return NextResponse.json({ execution_score, health })
  } catch (error) {
    return jsonMomentumError(error)
  }
}
