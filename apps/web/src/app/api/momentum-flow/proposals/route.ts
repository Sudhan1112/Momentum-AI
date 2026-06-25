import { NextResponse } from 'next/server'

import { parseJsonObject } from '@/lib/api-route-errors'
import { assertProjectMember, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { generateMomentumFlowProposal } from '@/lib/momentum/scheduler/momentum-flow-service'

export async function POST(req: Request) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const parsed = await parseJsonObject(req)
    if (!parsed.ok) return parsed.response

    const projectId = typeof parsed.body.project_id === 'string' ? parsed.body.project_id : null
    if (projectId) {
      const access = await assertProjectMember(projectId, session.data.user.id)
      if (!access.ok) return access.response
    }

    const proposal = await generateMomentumFlowProposal(session.data.user.id, {
      projectId,
      scheduleDate: typeof parsed.body.schedule_date === 'string' ? parsed.body.schedule_date : null,
      horizonDays: typeof parsed.body.horizon_days === 'number' ? parsed.body.horizon_days : null,
    })

    return NextResponse.json(proposal, { status: 201 })
  } catch (error) {
    return jsonMomentumError(error)
  }
}
