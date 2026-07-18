import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import {
  DEFAULT_OPS_COLUMNS,
  normalizeOpsColumns,
  type OpsColumnConfig,
} from '@/lib/opsTableColumns'
import {
  loadOpsTableColumns,
  loadSurveyQuestionsForOps,
  saveOpsTableColumns,
} from '@/lib/opsTablePrefs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Per-team + per-admin Live Ops column layout + per-survey question maps.
 * GET  /api/ops/table-preferences?surveyId=
 * PUT  /api/ops/table-preferences  { surveyId, columns }
 */
export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const surveyId = request.nextUrl.searchParams.get('surveyId')
  if (!surveyId) {
    return NextResponse.json({ error: 'surveyId required' }, { status: 400 })
  }

  try {
    const owned = await prisma.survey.findFirst({
      where: { id: surveyId, teamId: session.teamId },
      select: { id: true },
    })
    if (!owned) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    const columns = await loadOpsTableColumns({
      teamId: session.teamId,
      adminUserId: session.sub,
      surveyId,
    })
    const questions = await loadSurveyQuestionsForOps({
      teamId: session.teamId,
      surveyId,
    })

    return NextResponse.json(
      {
        teamId: session.teamId,
        adminUserId: session.sub,
        surveyId,
        columns,
        questions,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('Ops table-preferences GET error:', error)
    // Never hard-fail the UI builder — return defaults.
    return NextResponse.json(
      {
        teamId: session.teamId,
        adminUserId: session.sub,
        surveyId,
        columns: normalizeOpsColumns(DEFAULT_OPS_COLUMNS),
        questions: [],
        isDefault: true,
        warning: 'Preferences unavailable; using defaults',
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  }
}

export async function PUT(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      surveyId?: string
      columns?: OpsColumnConfig[]
    } | null

    const surveyId = body?.surveyId
    if (!surveyId || typeof surveyId !== 'string') {
      return NextResponse.json({ error: 'surveyId required' }, { status: 400 })
    }

    const owned = await prisma.survey.findFirst({
      where: { id: surveyId, teamId: session.teamId },
      select: { id: true },
    })
    if (!owned) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    const columns = await saveOpsTableColumns({
      teamId: session.teamId,
      adminUserId: session.sub,
      surveyId,
      columns: normalizeOpsColumns(body?.columns),
    })

    return NextResponse.json(
      {
        teamId: session.teamId,
        adminUserId: session.sub,
        surveyId,
        columns,
        isDefault: false,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('Ops table-preferences PUT error:', error)
    return NextResponse.json(
      {
        error:
          'Failed to save preferences. Redeploy so database schema is up to date, then try again.',
      },
      { status: 500 },
    )
  }
}
