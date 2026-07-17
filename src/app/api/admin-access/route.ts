import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'

const updateAdminAccessSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

async function resolveTeamId(request: NextRequest): Promise<string | null> {
  const session = await getAdminSessionFromRequest(request)
  if (session?.teamId) return session.teamId

  const surveyId = new URL(request.url).searchParams.get('surveyId')
  if (!surveyId) return null

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { teamId: true },
  })
  return survey?.teamId ?? null
}

export async function GET(request: NextRequest) {
  try {
    const teamId = await resolveTeamId(request)
    const session = await getAdminSessionFromRequest(request)

    let settings = teamId
      ? await prisma.adminAccessSettings.findFirst({ where: { teamId } })
      : null

    if (!settings && session) {
      settings = await prisma.adminAccessSettings.create({
        data: { teamId: session.teamId, password: '123' },
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching admin access settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin access settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { password } = updateAdminAccessSchema.parse(body)

    let settings = await prisma.adminAccessSettings.findFirst({
      where: { teamId: session.teamId },
    })

    if (settings) {
      settings = await prisma.adminAccessSettings.update({
        where: { id: settings.id },
        data: { password, teamId: session.teamId },
      })
    } else {
      settings = await prisma.adminAccessSettings.create({
        data: { password, teamId: session.teamId },
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error updating admin access settings:', error)
    return NextResponse.json(
      { error: 'Failed to update admin access settings' },
      { status: 500 }
    )
  }
}
