import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Secondary hydrate: player photo map after kiosk UI is already interactive */
export async function GET(
  _request: Request,
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

    const players = await prisma.player.findMany({
      where: {
        isActive: true,
        ...(survey.teamId ? { teamId: survey.teamId } : {}),
        image: { not: null },
      },
      select: { id: true, image: true },
    })

    const avatars: Record<string, string> = {}
    for (const p of players) {
      if (p.image) avatars[p.id] = p.image
    }

    return NextResponse.json(
      { avatars },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    )
  } catch (error) {
    console.error('Kiosk avatars error:', error)
    return NextResponse.json({ error: 'Failed to load avatars' }, { status: 500 })
  }
}
