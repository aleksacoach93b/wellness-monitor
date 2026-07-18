import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import {
  DEFAULT_OPS_COLUMNS,
  normalizeOpsColumns,
  type OpsColumnConfig,
} from '@/lib/opsTableColumns'
import { loadSurveyQuestionsForOps } from '@/lib/opsTablePrefs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Per-team + per-admin + per-survey Live Ops column layout + question maps.
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

    const row = await prisma.opsTablePreference.findUnique({
      where: {
        teamId_adminUserId_surveyId: {
          teamId: session.teamId,
          adminUserId: session.sub,
          surveyId,
        },
      },
      select: { columns: true, updatedAt: true },
    })

    const columns = normalizeOpsColumns(row?.columns ?? DEFAULT_OPS_COLUMNS)
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
        updatedAt: row?.updatedAt?.toISOString() ?? null,
        isDefault: !row,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('Ops table-preferences GET error:', error)
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 })
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

    const columns = normalizeOpsColumns(body?.columns)

    const row = await prisma.opsTablePreference.upsert({
      where: {
        teamId_adminUserId_surveyId: {
          teamId: session.teamId,
          adminUserId: session.sub,
          surveyId,
        },
      },
      create: {
        teamId: session.teamId,
        adminUserId: session.sub,
        surveyId,
        columns,
      },
      update: { columns },
      select: { columns: true, updatedAt: true },
    })

    return NextResponse.json(
      {
        teamId: session.teamId,
        adminUserId: session.sub,
        surveyId,
        columns: normalizeOpsColumns(row.columns),
        updatedAt: row.updatedAt.toISOString(),
        isDefault: false,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('Ops table-preferences PUT error:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
