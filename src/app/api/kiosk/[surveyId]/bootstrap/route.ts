import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Fast kiosk open payload — NO player images / NO questions.
 * Images hydrate via /avatars; questions load when coach mode opens.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  try {
    const { surveyId } = await params

    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: {
        id: true,
        teamId: true,
        title: true,
        description: true,
        isActive: true,
        isRecurring: true,
        startDate: true,
        endDate: true,
        dailyStartTime: true,
        dailyEndTime: true,
        timezone: true,
        trackSessionType: true,
        trackMatchDay: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
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
          password: true,
          // image intentionally omitted — hydrate via /avatars
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
        image: null as string | null,
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
          'Cache-Control': 'private, no-store',
        },
      },
    )
  } catch (error) {
    console.error('Kiosk bootstrap error:', error)
    return NextResponse.json({ error: 'Failed to load kiosk' }, { status: 500 })
  }
}
