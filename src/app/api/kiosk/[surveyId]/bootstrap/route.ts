import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Single-round-trip payload for kiosk open:
 * settings + survey + players/status + tags + admin-access password.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  try {
    const { surveyId } = await params

    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    const teamId = survey.teamId
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [kioskSettings, adminAccess, tags, players, responses] = await Promise.all([
      teamId
        ? prisma.kioskSettings.findFirst({
            where: { teamId },
            select: {
              password: true,
              coachPassword: true,
              theme: true,
              clubName: true,
              clubLogo: true,
              showClubBranding: true,
              isEnabled: true,
            },
          })
        : Promise.resolve(null),
      teamId
        ? prisma.adminAccessSettings.findFirst({
            where: { teamId },
            select: { password: true },
          })
        : Promise.resolve(null),
      teamId
        ? prisma.tag.findMany({
            where: { teamId, isActive: true },
            select: { name: true, category: true },
            orderBy: [{ category: 'asc' }, { order: 'asc' }, { name: 'asc' }],
          })
        : Promise.resolve([]),
      prisma.player.findMany({
        where: {
          isActive: true,
          ...(teamId ? { teamId } : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          image: true,
          password: true,
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      prisma.response.findMany({
        where: {
          surveyId,
          submittedAt: { gte: today, lt: tomorrow },
          playerId: { not: null },
        },
        select: { id: true, playerId: true },
      }),
    ])

    const responseByPlayer = new Map<string, string>()
    for (const r of responses) {
      if (r.playerId && !responseByPlayer.has(r.playerId)) {
        responseByPlayer.set(r.playerId, r.id)
      }
    }

    const playersWithStatus = players.map((player) => {
      const responseId = responseByPlayer.get(player.id)
      return {
        ...player,
        hasResponded: Boolean(responseId),
        responseId,
      }
    })

    return NextResponse.json(
      {
        survey,
        kioskSettings,
        adminAccessPassword: adminAccess?.password ?? '123',
        tags,
        players: playersWithStatus,
      },
      {
        headers: {
          // Private device kiosk; avoid intermediary caching of live status
          'Cache-Control': 'private, no-store',
        },
      },
    )
  } catch (error) {
    console.error('Kiosk bootstrap error:', error)
    return NextResponse.json({ error: 'Failed to load kiosk' }, { status: 500 })
  }
}
