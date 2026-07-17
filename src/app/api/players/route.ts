import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { generatePlayerPassword } from '@/lib/passwordUtils'
import { getAdminSessionFromRequest, teamWhere } from '@/lib/auth/adminSession'

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    if (!body.firstName || !body.lastName) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      )
    }

    const playerData = {
      teamId: session.teamId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone || null,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      image: body.image || null,
      password: body.password || generatePlayerPassword(body.firstName, body.lastName)
    } as Prisma.PlayerUncheckedCreateInput

    const player = await prisma.player.create({
      data: playerData
    })

    return NextResponse.json(player)
  } catch (error) {
    console.error('Error creating player:', error)
    return NextResponse.json(
      { error: 'Failed to create player', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const players = await prisma.player.findMany({
      where: teamWhere(session),
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(players)
  } catch (error) {
    console.error('Error fetching players:', error)
    return NextResponse.json(
      { error: 'Failed to fetch players' },
      { status: 500 }
    )
  }
}
