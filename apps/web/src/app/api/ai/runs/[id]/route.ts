import { NextResponse } from 'next/server'

import { getAiRunWithCitations } from '@/lib/momentum/ai/run-logger'
import { canReadAiRun, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'

type RouteContext = {
  params: {
    id: string
  }
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const access = await canReadAiRun(params.id, session.data.user.id)
    if (!access.ok) return access.response

    const run = await getAiRunWithCitations(params.id)
    if (!run) {
      return NextResponse.json({ error: 'AI run not found' }, { status: 404 })
    }

    return NextResponse.json(run)
  } catch (error) {
    return jsonMomentumError(error)
  }
}
