import { NextResponse } from 'next/server'

import { requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { normalizeMomentumFlowError } from '@/lib/momentum/scheduler/momentum-flow-readiness'
import { explainMomentumFlowProposal } from '@/lib/momentum/scheduler/momentum-flow-service'

type RouteContext = {
  params: {
    id: string
  }
}

export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const explanation = await explainMomentumFlowProposal(session.data.user.id, params.id)
    return NextResponse.json(explanation)
  } catch (error) {
    return jsonMomentumError(normalizeMomentumFlowError(error))
  }
}
