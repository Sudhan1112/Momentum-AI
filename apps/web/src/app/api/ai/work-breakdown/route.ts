import { NextResponse } from 'next/server'

import { parseJsonObject } from '@/lib/api-route-errors'
import { generateWorkBreakdown } from '@/lib/momentum/ai/capabilities/work-breakdown'
import { assertProjectWriteRole, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'

export async function POST(req: Request) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const parsed = await parseJsonObject(req)
    if (!parsed.ok) return parsed.response

    const projectId = typeof parsed.body.project_id === 'string' ? parsed.body.project_id : ''
    const access = await assertProjectWriteRole(projectId, session.data.user.id)
    if (!access.ok) return access.response

    const result = await generateWorkBreakdown(session.data.user.id, {
      goal: typeof parsed.body.goal === 'string' ? parsed.body.goal : '',
      projectId,
    })

    return NextResponse.json(result)
  } catch (error) {
    return jsonMomentumError(error)
  }
}
