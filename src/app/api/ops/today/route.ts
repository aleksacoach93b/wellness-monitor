import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function todayWindow() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return { today, tomorrow }
}

/**
 * Live Ops: today's check-in status for the session's team only.
 * Never accepts a client-supplied teamId — scope is always session.teamId.
 */
export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamId = session.teamId
  const surveyIdParam = request.nextUrl.searchParams.get('surveyId')

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true },
    })
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const surveys = await prisma.survey.findMany({
      where: { teamId },
      select: { id: true, title: true, isActive: true, updatedAt: true },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    })

    let survey: { id: string; title: string; isActive: boolean } | null = null

    if (surveyIdParam) {
      const owned = surveys.find((s) => s.id === surveyIdParam)
      if (!owned) {
        // Wrong team or unknown id — never leak existence across teams
        return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
      }
      survey = { id: owned.id, title: owned.title, isActive: owned.isActive }
    } else if (surveys.length === 1) {
      const only = surveys[0]
      survey = { id: only.id, title: only.title, isActive: only.isActive }
    } else {
      const active = surveys.filter((s) => s.isActive)
      const pick = active[0] ?? surveys[0] ?? null
      if (pick) {
        survey = { id: pick.id, title: pick.title, isActive: pick.isActive }
      }
    }

    const { today, tomorrow } = todayWindow()

    const [players, responses] = await Promise.all([
      prisma.player.findMany({
        where: { teamId, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          image: true,
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      survey
        ? prisma.response.findMany({
            where: {
              surveyId: survey.id,
              survey: { teamId },
              submittedAt: { gte: today, lt: tomorrow },
              playerId: { not: null },
            },
            select: {
              id: true,
              playerId: true,
              submittedAt: true,
            },
            orderBy: { submittedAt: 'desc' },
          })
        : Promise.resolve([]),
    ])

    const latestByPlayer = new Map<string, { submittedAt: Date }>()
    for (const r of responses) {
      if (!r.playerId) continue
      if (!latestByPlayer.has(r.playerId)) {
        latestByPlayer.set(r.playerId, { submittedAt: r.submittedAt })
      }
    }

    const playerRows = players.map((p) => {
      const hit = latestByPlayer.get(p.id)
      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        image: p.image,
        status: hit ? ('done' as const) : ('pending' as const),
        submittedAt: hit ? hit.submittedAt.toISOString() : null,
      }
    })

    const done = playerRows.filter((p) => p.status === 'done').length
    const total = playerRows.length

    return NextResponse.json(
      {
        team,
        survey,
        surveys: surveys.map((s) => ({
          id: s.id,
          title: s.title,
          isActive: s.isActive,
        })),
        generatedAt: new Date().toISOString(),
        stats: {
          total,
          done,
          pending: total - done,
        },
        players: playerRows,
      },
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  } catch (error) {
    console.error('Ops today error:', error)
    return NextResponse.json({ error: 'Failed to load live ops' }, { status: 500 })
  }
}
