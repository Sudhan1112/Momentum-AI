import { NextResponse } from 'next/server'

import { parseJsonObject } from '@/lib/api-route-errors'
import { assertProjectMember, assertProjectWriteRole, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { createTask, listProjectTasks } from '@/lib/momentum/tasks/task-service'
import type { CreateTaskInput } from '@/types/task'

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

    const tasks = await listProjectTasks(params.id)
    return NextResponse.json({ role: access.data.role, tasks })
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

    const task = await createTask(params.id, session.data.user.id, parsed.body as CreateTaskInput)
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    return jsonMomentumError(error)
  }
}
