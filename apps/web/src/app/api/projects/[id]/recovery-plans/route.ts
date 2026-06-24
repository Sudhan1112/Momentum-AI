import { NextResponse } from 'next/server'

import { assertProjectMember, assertProjectWriteRole, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { createRecoveryPlan, listRecoveryPlans } from '@/lib/momentum/recovery-service'

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

    const plans = await listRecoveryPlans(params.id)
    return NextResponse.json(plans)
  } catch (error) {
    return jsonMomentumError(error)
  }
}

export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const access = await assertProjectWriteRole(params.id, session.data.user.id)
    if (!access.ok) return access.response

    const plan = await createRecoveryPlan(params.id, session.data.user.id)
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    return jsonMomentumError(error)
  }
}
