import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getAdminSessionFromRequest,
  isSuperAdmin,
} from '@/lib/auth/adminSession'

/** Super admin: list all platform admins + their teams */
export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admins = await prisma.adminUser.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        select: {
          role: true,
          team: {
            select: {
              id: true,
              name: true,
              _count: {
                select: {
                  players: true,
                  surveys: true,
                },
              },
            },
          },
        },
      },
    },
  })

  return NextResponse.json({
    admins: admins.map((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      role: a.role,
      isActive: a.isActive,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      teams: a.memberships.map((m) => ({
        id: m.team.id,
        name: m.team.name,
        membershipRole: m.role,
        players: m.team._count.players,
        surveys: m.team._count.surveys,
      })),
    })),
  })
}
