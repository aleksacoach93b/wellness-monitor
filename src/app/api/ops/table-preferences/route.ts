import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import {
  DEFAULT_OPS_COLUMNS,
  normalizeOpsColumns,
  type OpsColumnConfig,
} from '@/lib/opsTableColumns'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Per-team + per-admin Live Ops table column layout.
 * GET  /api/ops/table-preferences
 * PUT  /api/ops/table-preferences  { columns: OpsColumnConfig[] }
 */
export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const row = await prisma.opsTablePreference.findUnique({
      where: {
        teamId_adminUserId: {
          teamId: session.teamId,
          adminUserId: session.sub,
        },
      },
      select: { columns: true, updatedAt: true },
    })

    const columns = normalizeOpsColumns(row?.columns ?? DEFAULT_OPS_COLUMNS)
    return NextResponse.json(
      {
        teamId: session.teamId,
        adminUserId: session.sub,
        columns,
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
      columns?: OpsColumnConfig[]
    } | null
    const columns = normalizeOpsColumns(body?.columns)

    const row = await prisma.opsTablePreference.upsert({
      where: {
        teamId_adminUserId: {
          teamId: session.teamId,
          adminUserId: session.sub,
        },
      },
      create: {
        teamId: session.teamId,
        adminUserId: session.sub,
        columns,
      },
      update: { columns },
      select: { columns: true, updatedAt: true },
    })

    return NextResponse.json(
      {
        teamId: session.teamId,
        adminUserId: session.sub,
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
