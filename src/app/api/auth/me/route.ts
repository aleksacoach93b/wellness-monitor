import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [user, team] = await Promise.all([
    prisma.adminUser.findUnique({
      where: { id: session.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    }),
    prisma.team.findUnique({
      where: { id: session.teamId },
      select: { id: true, name: true },
    }),
  ])

  if (!user?.isActive) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    user,
    team,
    session: {
      teamId: session.teamId,
      role: session.role,
    },
  })
}
