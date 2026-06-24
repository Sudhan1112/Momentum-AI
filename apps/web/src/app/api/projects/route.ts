import { NextResponse } from 'next/server'

import { parseJsonObject } from '@/lib/api-route-errors'
import { requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { createProject, listProjectsForUser } from '@/lib/momentum/projects/project-service'
import type { CreateProjectInput } from '@/types/project'

export async function GET() {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const projects = await listProjectsForUser(session.data.user.id)
    return NextResponse.json(projects)
  } catch (error) {
    return jsonMomentumError(error)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const parsed = await parseJsonObject(req)
    if (!parsed.ok) return parsed.response

    const project = await createProject(session.data.user.id, parsed.body as CreateProjectInput)
    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    return jsonMomentumError(error)
  }
}
