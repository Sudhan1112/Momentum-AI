import { NextResponse } from 'next/server'

import { parseJsonObject } from '@/lib/api-route-errors'
import { assertProjectMember, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { askMomentumQuestion } from '@/lib/momentum/memory/ask-momentum-service'
import type { AskMomentumQueryInput } from '@/types/project-intelligence'

type RouteContext = {
  params: {
    id: string
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const access = await assertProjectMember(params.id, session.data.user.id)
    if (!access.ok) return access.response

    const parsed = await parseJsonObject(req)
    if (!parsed.ok) return parsed.response

    const body = parsed.body as AskMomentumQueryInput
    const answer = await askMomentumQuestion(params.id, session.data.user.id, body.question)
    return NextResponse.json(answer)
  } catch (error) {
    return jsonMomentumError(error)
  }
}
