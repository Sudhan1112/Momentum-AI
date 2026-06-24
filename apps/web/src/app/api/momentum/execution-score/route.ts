import { NextResponse } from 'next/server'

import { getWorkspaceExecutionScore } from '@/lib/momentum/execution-score'
import { calculateWorkspaceHealth } from '@/lib/momentum/health-snapshot'
import { requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'

export async function GET() {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const execution_score = await getWorkspaceExecutionScore(session.data.user.id)
    const health = calculateWorkspaceHealth(execution_score)

    return NextResponse.json({ execution_score, health })
  } catch (error) {
    return jsonMomentumError(error)
  }
}
