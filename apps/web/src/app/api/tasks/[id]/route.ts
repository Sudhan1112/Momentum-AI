import { NextResponse } from 'next/server'

import { parseJsonObject } from '@/lib/api-route-errors'
import { assertTaskAccess, requireSession } from '@/lib/momentum/authz'
import { jsonError } from '@/lib/api-route-errors'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { deleteTask, getTask, updateTask } from '@/lib/momentum/tasks/task-service'

const TASK_WRITE_ROLES = new Set(['owner', 'admin', 'editor'])

type RouteContext = {
  params: {
    id: string
  }
}

function canWrite(role: string) {
  return TASK_WRITE_ROLES.has(role)
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const access = await assertTaskAccess(params.id, session.data.user.id)
    if (!access.ok) return access.response

    const task = await getTask(params.id)
    return NextResponse.json({ ...task, current_user_role: access.data.role })
  } catch (error) {
    return jsonMomentumError(error)
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const access = await assertTaskAccess(params.id, session.data.user.id)
    if (!access.ok) return access.response
    if (!canWrite(access.data.role)) return jsonError('Forbidden', 403)

    const parsed = await parseJsonObject(req)
    if (!parsed.ok) return parsed.response

    const task = await updateTask(params.id, parsed.body)
    return NextResponse.json({ ...task, current_user_role: access.data.role })
  } catch (error) {
    return jsonMomentumError(error)
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const access = await assertTaskAccess(params.id, session.data.user.id)
    if (!access.ok) return access.response
    if (!canWrite(access.data.role)) return jsonError('Forbidden', 403)

    const result = await deleteTask(params.id)
    return NextResponse.json(result)
  } catch (error) {
    return jsonMomentumError(error)
  }
}
