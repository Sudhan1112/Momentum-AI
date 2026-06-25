import { NextResponse } from 'next/server'

import { parseJsonObject } from '@/lib/api-route-errors'
import { extractTaskProposals } from '@/lib/momentum/ai/capabilities/extract-tasks'
import { assertProjectWriteRole, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'

export async function POST(req: Request) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const parsed = await parseJsonObject(req)
    if (!parsed.ok) return parsed.response

    const projectId = typeof parsed.body.project_id === 'string' ? parsed.body.project_id : null
    if (projectId) {
      const access = await assertProjectWriteRole(projectId, session.data.user.id)
      if (!access.ok) return access.response
    }

    const result = await extractTaskProposals(session.data.user.id, {
      text: typeof parsed.body.text === 'string' ? parsed.body.text : '',
      projectId,
      documentId: typeof parsed.body.document_id === 'string' ? parsed.body.document_id : null,
    })

    return NextResponse.json(result)
  } catch (error) {
    return jsonMomentumError(error)
  }
}
