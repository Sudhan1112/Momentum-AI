import { NextResponse } from 'next/server'

import { parseJsonObject } from '@/lib/api-route-errors'
import { requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { updateMomentumFlowSession, type MomentumFlowSessionStatus } from '@/lib/momentum/scheduler/momentum-flow-service'

type RouteContext = {
  params: {
    id: string
  }
}

const UPDATE_STATUSES = new Set<MomentumFlowSessionStatus>(['scheduled', 'locked', 'completed', 'skipped'])

function sessionStatus(value: unknown) {
  return typeof value === 'string' && UPDATE_STATUSES.has(value as MomentumFlowSessionStatus)
    ? (value as MomentumFlowSessionStatus)
    : null
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const parsed = await parseJsonObject(req)
    if (!parsed.ok) return parsed.response

    const updated = await updateMomentumFlowSession(session.data.user.id, params.id, {
      startAt: typeof parsed.body.start_at === 'string' ? parsed.body.start_at : null,
      endAt: typeof parsed.body.end_at === 'string' ? parsed.body.end_at : null,
      status: sessionStatus(parsed.body.status),
      isLocked: typeof parsed.body.is_locked === 'boolean' ? parsed.body.is_locked : null,
    })

    return NextResponse.json(updated)
  } catch (error) {
    return jsonMomentumError(error)
  }
}
