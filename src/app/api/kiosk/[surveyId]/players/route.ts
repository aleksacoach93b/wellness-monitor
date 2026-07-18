import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  try {
    const { surveyId } = await params

    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: { teamId: true },
    })
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [players, responses] = await Promise.all([
      prisma.player.findMany({
        where: {
          isActive: true,
          ...(survey.teamId ? { teamId: survey.teamId } : {}),
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

    return NextResponse.json(playersWithStatus, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('Error fetching players for kiosk:', error)
    return NextResponse.json(
      { error: 'Failed to fetch players' },
      { status: 500 },
    )
  }
}
