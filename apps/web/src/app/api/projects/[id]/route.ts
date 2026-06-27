import { NextResponse } from 'next/server'

import { parseJsonObject } from '@/lib/api-route-errors'
import { assertProjectMember, assertProjectOwner, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { deleteProject, getProject, updateProject } from '@/lib/momentum/projects/project-service'

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

    const project = await getProject(params.id)
    return NextResponse.json({ ...project, current_user_role: access.data.role })
  } catch (error) {
    return jsonMomentumError(error)
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const access = await assertProjectOwner(params.id, session.data.user.id)
    if (!access.ok) return access.response

    const parsed = await parseJsonObject(req)
    if (!parsed.ok) return parsed.response

    const changeReason = typeof parsed.body.change_reason === 'string' ? parsed.body.change_reason : null
    const changes = { ...parsed.body }
    delete changes.change_reason
    const project = await updateProject(params.id, session.data.user.id, changes, { reason: changeReason })
    return NextResponse.json({ ...project, current_user_role: access.data.role })
  } catch (error) {
    return jsonMomentumError(error)
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const access = await assertProjectOwner(params.id, session.data.user.id)
    if (!access.ok) return access.response

    const result = await deleteProject(params.id)
    return NextResponse.json(result)
  } catch (error) {
    return jsonMomentumError(error)
  }
}
