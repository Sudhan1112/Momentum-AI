import { NextResponse } from 'next/server'

import { parseJsonObject } from '@/lib/api-route-errors'
import { requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { applyMomentumFlowProposal } from '@/lib/momentum/scheduler/momentum-flow-service'

type RouteContext = {
  params: {
    id: string
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const parsed = await parseJsonObject(req)
    if (!parsed.ok) return parsed.response

    const rawSessionIds = Array.isArray(parsed.body.session_ids) ? parsed.body.session_ids : []
    const proposal = await applyMomentumFlowProposal(session.data.user.id, params.id, {
      sessionIds: rawSessionIds.filter((id): id is string => typeof id === 'string'),
    })

    return NextResponse.json(proposal)
  } catch (error) {
    return jsonMomentumError(error)
  }
}
