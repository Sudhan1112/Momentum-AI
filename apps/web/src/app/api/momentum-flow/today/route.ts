import { NextResponse } from 'next/server'

import { assertProjectMember, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { normalizeMomentumFlowError } from '@/lib/momentum/scheduler/momentum-flow-readiness'
import { getLatestMomentumExecutionPlan } from '@/lib/momentum/scheduler/execution-intelligence-service'

export async function GET(req: Request) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const url = new URL(req.url)
    const projectId = url.searchParams.get('project_id')
    if (projectId) {
      const access = await assertProjectMember(projectId, session.data.user.id)
      if (!access.ok) return access.response
    }

    const today = await getLatestMomentumExecutionPlan(session.data.user.id, projectId)
    return NextResponse.json(today)
  } catch (error) {
    return jsonMomentumError(normalizeMomentumFlowError(error))
  }
}
