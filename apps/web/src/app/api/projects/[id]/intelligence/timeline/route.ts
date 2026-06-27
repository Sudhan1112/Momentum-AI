import { NextResponse } from 'next/server'

import { assertProjectMember, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { listProjectTimeline } from '@/lib/momentum/memory/project-intelligence-service'

type RouteContext = {
  params: {
    id: string
  }
}

export async function GET(req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const access = await assertProjectMember(params.id, session.data.user.id)
    if (!access.ok) return access.response

    const filter = new URL(req.url).searchParams.get('filter')
    const timeline = await listProjectTimeline(params.id, filter)
    return NextResponse.json(timeline)
  } catch (error) {
    return jsonMomentumError(error)
  }
}
