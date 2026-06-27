import { NextResponse } from 'next/server'

import { parseJsonObject } from '@/lib/api-route-errors'
import { assertProjectMember, assertProjectWriteRole, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { listProjectDecisions, recordProjectDecision } from '@/lib/momentum/memory/project-intelligence-service'
import type { RecordProjectDecisionInput } from '@/types/project-intelligence'

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

    const decisions = await listProjectDecisions(params.id)
    return NextResponse.json(decisions)
  } catch (error) {
    return jsonMomentumError(error)
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const access = await assertProjectWriteRole(params.id, session.data.user.id)
    if (!access.ok) return access.response

    const parsed = await parseJsonObject(req)
    if (!parsed.ok) return parsed.response

    const decision = await recordProjectDecision(params.id, session.data.user.id, parsed.body as RecordProjectDecisionInput)
    return NextResponse.json(decision, { status: 201 })
  } catch (error) {
    return jsonMomentumError(error)
  }
}
