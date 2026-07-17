import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  getAdminSessionFromRequest,
  isSuperAdmin,
} from '@/lib/auth/adminSession'

const createSchema = z.object({
  email: z.string().email(),
  suggestedTeamName: z.string().trim().min(1).max(120).optional(),
})

/** Super admin: create invite-only signup link */
export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { email, suggestedTeamName } = createSchema.parse(body)
    const normalized = email.trim().toLowerCase()

    const existingUser = await prisma.adminUser.findUnique({
      where: { email: normalized },
    })
    if (existingUser) {
      return NextResponse.json(
        { error: 'An admin with this email already exists' },
        { status: 409 }
      )
    }

    // Revoke previous pending invites for same email
    await prisma.invite.updateMany({
      where: { email: normalized, status: 'PENDING' },
      data: { status: 'REVOKED' },
    })

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const invite = await prisma.invite.create({
      data: {
        email: normalized,
        token,
        invitedById: session.sub,
        suggestedTeamName: suggestedTeamName || null,
        expiresAt,
      },
    })

    const origin = request.nextUrl.origin
    const inviteUrl = `${origin}/admin/invite/${invite.token}`

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt,
        suggestedTeamName: invite.suggestedTeamName,
      },
      inviteUrl,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid invite data' }, { status: 400 })
    }
    console.error('Create invite error:', error)
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
  }
}

/** Super admin: list invites */
export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      acceptedTeam: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ invites })
}
