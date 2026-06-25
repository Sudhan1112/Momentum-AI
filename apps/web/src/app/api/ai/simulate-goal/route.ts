import { NextResponse } from 'next/server'

import { parseJsonObject } from '@/lib/api-route-errors'
import { assertProjectMember, requireSession } from '@/lib/momentum/authz'
import { jsonMomentumError } from '@/lib/momentum/errors'
import { simulateGoal } from '@/lib/momentum/simulation-service'

export async function POST(req: Request) {
  try {
    const session = await requireSession()
    if (!session.ok) return session.response

    const parsed = await parseJsonObject(req)
    if (!parsed.ok) return parsed.response

    const projectId = typeof parsed.body.project_id === 'string' ? parsed.body.project_id : ''
    const access = await assertProjectMember(projectId, session.data.user.id)
    if (!access.ok) return access.response

    const simulation = await simulateGoal(session.data.user.id, {
      projectId,
      targetDeadline: typeof parsed.body.target_deadline === 'string' ? parsed.body.target_deadline : null,
      dailyWorkHours: typeof parsed.body.daily_work_hours === 'number' ? parsed.body.daily_work_hours : null,
      extraDailyHours: typeof parsed.body.extra_daily_hours === 'number' ? parsed.body.extra_daily_hours : null,
      delayTaskId: typeof parsed.body.delay_task_id === 'string' ? parsed.body.delay_task_id : null,
      delayDays: typeof parsed.body.delay_days === 'number' ? parsed.body.delay_days : null,
      shiftMilestoneDays: typeof parsed.body.shift_milestone_days === 'number' ? parsed.body.shift_milestone_days : null,
      removeCompletedTasks: Boolean(parsed.body.remove_completed_tasks),
    })

    return NextResponse.json(simulation, { status: 201 })
  } catch (error) {
    return jsonMomentumError(error)
  }
}
