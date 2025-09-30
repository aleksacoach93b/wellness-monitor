import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
) {
  try {
    const { surveyId } = await params

    // Get all active players
    const players = await prisma.player.findMany({
      where: { isActive: true },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    })

    // Get today's responses for this survey only
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const responses = await prisma.response.findMany({
      where: { 
        surveyId,
        submittedAt: {
          gte: today,
          lt: tomorrow
        }
      },
      select: { id: true, playerId: true }
    })

    // Create a set of player IDs who have responded today
    const respondedPlayerIds = new Set(responses.map(r => r.playerId).filter(Boolean))

    // Add response status to each player
    const playersWithStatus = players.map(player => ({
      ...player,
      hasResponded: respondedPlayerIds.has(player.id),
      responseId: respondedPlayerIds.has(player.id) 
        ? responses.find(r => r.playerId === player.id)?.id || undefined 
        : undefined
    }))

    return NextResponse.json(playersWithStatus)
  } catch (error) {
    console.error('Error fetching players for kiosk:', error)
    return NextResponse.json(
      { error: 'Failed to fetch players' },
      { status: 500 }
    )
  }
}
