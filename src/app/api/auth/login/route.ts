import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth/password'
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  signAdminSession,
} from '@/lib/auth/adminSession'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = schema.parse(body)
    const normalized = email.trim().toLowerCase()

    const user = await prisma.adminUser.findUnique({
      where: { email: normalized },
      include: {
        memberships: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    })

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const teamId = user.memberships[0]?.teamId
    if (!teamId) {
      return NextResponse.json(
        { error: 'No team assigned to this account. Contact the platform admin.' },
        { status: 403 }
      )
    }

    const token = await signAdminSession({
      sub: user.id,
      email: user.email,
      role: user.role,
      teamId,
      name: user.name,
    })

    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        teamId,
      },
    })
    res.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions())
    return res
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid login data' }, { status: 400 })
    }
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
