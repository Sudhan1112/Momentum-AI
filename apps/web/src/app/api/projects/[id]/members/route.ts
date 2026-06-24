import { NextResponse } from 'next/server'

import { parseJsonObject } from '@/lib/api-route-errors'
import { assertProjectMember, assertProjectOwnerOrAdmin, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { addProjectMember, listProjectMembers } from '@/lib/momentum/projects/member-service'

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

    const members = await listProjectMembers(params.id)
    return NextResponse.json({ role: access.data.role, members })
  } catch (error) {
    return jsonMomentumError(error)
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const access = await assertProjectOwnerOrAdmin(params.id, session.data.user.id)
    if (!access.ok) return access.response

    const parsed = await parseJsonObject(req)
    if (!parsed.ok) return parsed.response

    const userId = parsed.body.user_id
    const member = await addProjectMember(params.id, userId as string, parsed.body.role)
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    return jsonMomentumError(error)
  }
}
