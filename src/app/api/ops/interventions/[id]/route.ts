import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import { setInterventionStatus } from '@/lib/opsRulesService'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

  try {
    const body = (await request.json().catch(() => null)) as {
      status?: string
      note?: string | null
    } | null

    const status = body?.status
    if (status !== 'OPEN' && status !== 'ACKNOWLEDGED' && status !== 'RESOLVED') {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    }

    const intervention = await setInterventionStatus({
      teamId: session.teamId,
      id,
      status,
      note: body?.note,
    })
    if (!intervention) {
      return NextResponse.json({ error: 'Intervention not found' }, { status: 404 })
    }
    return NextResponse.json({ intervention })
  } catch (error) {
    console.error('Ops interventions PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update intervention' }, { status: 500 })
  }
}
