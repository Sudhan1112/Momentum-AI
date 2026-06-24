import { NextResponse } from 'next/server'

import { assertProjectOwnerOrAdmin, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { removeProjectMember } from '@/lib/momentum/projects/member-service'

type RouteContext = {
  params: {
    id: string
    userId: string
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const access = await assertProjectOwnerOrAdmin(params.id, session.data.user.id)
    if (!access.ok) return access.response

    const result = await removeProjectMember(params.id, params.userId)
    return NextResponse.json(result)
  } catch (error) {
    return jsonMomentumError(error)
  }
}
