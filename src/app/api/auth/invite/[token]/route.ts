import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  signAdminSession,
} from '@/lib/auth/adminSession'

const acceptSchema = z.object({
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(200),
  teamName: z.string().trim().min(1).max(120),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const invite = await prisma.invite.findUnique({ where: { token } })

  if (!invite || invite.status !== 'PENDING') {
    return NextResponse.json({ error: 'Invite not found or already used' }, { status: 404 })
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Invite expired' }, { status: 410 })
  }

  return NextResponse.json({
    email: invite.email,
    suggestedTeamName: invite.suggestedTeamName,
    expiresAt: invite.expiresAt,
  })
}

/** Accept invite: set password, create team + admin user, log in */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  try {
    const invite = await prisma.invite.findUnique({ where: { token } })
    if (!invite || invite.status !== 'PENDING') {
      return NextResponse.json({ error: 'Invite not found or already used' }, { status: 404 })
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invite expired' }, { status: 410 })
    }

    const body = await request.json()
    const { name, password, teamName } = acceptSchema.parse(body)

    const existing = await prisma.adminUser.findUnique({
      where: { email: invite.email },
    })
    if (existing) {
      return NextResponse.json({ error: 'Account already exists for this email' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)

    const result = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: { name: teamName },
      })

      const user = await tx.adminUser.create({
        data: {
          email: invite.email,
          passwordHash,
          name,
          role: 'TEAM_ADMIN',
        },
      })

      await tx.teamMembership.create({
        data: {
          teamId: team.id,
          adminUserId: user.id,
          role: 'OWNER',
        },
      })

      await tx.kioskSettings.create({
        data: {
          teamId: team.id,
          clubName: teamName,
          showClubBranding: true,
        },
      })

      await tx.adminAccessSettings.create({
        data: {
          teamId: team.id,
          password: '123',
        },
      })

      await tx.invite.update({
        where: { id: invite.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          acceptedTeamId: team.id,
        },
      })

      return { team, user }
    })

    const sessionToken = await signAdminSession({
      sub: result.user.id,
      email: result.user.email,
      role: result.user.role,
      teamId: result.team.id,
      name: result.user.name,
    })

    const res = NextResponse.json({
      ok: true,
      team: { id: result.team.id, name: result.team.name },
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
    })
    res.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, adminSessionCookieOptions())
    return res
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Name, team name, and password (min 8 chars) are required' },
        { status: 400 }
      )
    }
    console.error('Accept invite error:', error)
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
  }
}
