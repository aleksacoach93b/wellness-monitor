import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  getAdminSessionFromRequest,
  isSuperAdmin,
} from '@/lib/auth/adminSession'

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  teamName: z.string().trim().min(1).max(120).optional(),
  teamId: z.string().min(1).optional(),
})

async function requireSuper(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session || !isSuperAdmin(session)) return null
  return session
}

/** Super admin: edit name/email, rename team, block/unblock */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSuper(request)
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const target = await prisma.adminUser.findUnique({
    where: { id },
    include: { memberships: { select: { teamId: true } } },
  })
  if (!target) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const data = patchSchema.parse(body)

    if (target.role === 'SUPER' && data.isActive === false) {
      return NextResponse.json(
        { error: 'Cannot deactivate the super admin account' },
        { status: 400 },
      )
    }

    if (data.email) {
      const normalized = data.email.trim().toLowerCase()
      if (normalized !== target.email) {
        const taken = await prisma.adminUser.findUnique({
          where: { email: normalized },
        })
        if (taken) {
          return NextResponse.json(
            { error: 'Another admin already uses this email' },
            { status: 409 },
          )
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.email !== undefined
            ? { email: data.email.trim().toLowerCase() }
            : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
      })

      if (data.teamName) {
        const teamId =
          data.teamId ||
          target.memberships[0]?.teamId ||
          null
        if (!teamId) {
          throw new Error('NO_TEAM')
        }
        await tx.team.update({
          where: { id: teamId },
          data: { name: data.teamName },
        })
      }

      return user
    })

    return NextResponse.json({
      ok: true,
      admin: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        isActive: updated.isActive,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'NO_TEAM') {
      return NextResponse.json(
        { error: 'This admin has no team to rename' },
        { status: 400 },
      )
    }
    console.error('Patch admin error:', error)
    return NextResponse.json({ error: 'Failed to update admin' }, { status: 500 })
  }
}

/**
 * Super admin: delete a team admin.
 * By default also deletes their owned team(s) and all team data (players, surveys, …).
 * Query: ?keepTeam=1 to remove only the login (orphan team kept — rarely useful).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSuper(request)
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (id === session.sub) {
    return NextResponse.json(
      { error: 'You cannot delete your own super admin account' },
      { status: 400 },
    )
  }

  const target = await prisma.adminUser.findUnique({
    where: { id },
    include: {
      memberships: {
        select: { teamId: true, role: true },
      },
    },
  })
  if (!target) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
  }
  if (target.role === 'SUPER') {
    return NextResponse.json(
      { error: 'Cannot delete a super admin account' },
      { status: 400 },
    )
  }

  const keepTeam = request.nextUrl.searchParams.get('keepTeam') === '1'
  const ownedTeamIds = target.memberships
    .filter((m) => m.role === 'OWNER')
    .map((m) => m.teamId)

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invite.updateMany({
        where: { email: target.email, status: 'PENDING' },
        data: { status: 'REVOKED' },
      })

      // Clear invite FK that points at this user as inviter before delete
      // (invitesSent has onDelete Cascade from AdminUser — OK)
      // acceptedTeam SetNull is fine

      if (!keepTeam && ownedTeamIds.length > 0) {
        await tx.team.deleteMany({
          where: { id: { in: ownedTeamIds } },
        })
      }

      await tx.adminUser.delete({ where: { id } })
    })

    return NextResponse.json({
      ok: true,
      deletedAdminId: id,
      deletedTeams: keepTeam ? [] : ownedTeamIds,
    })
  } catch (error) {
    console.error('Delete admin error:', error)
    return NextResponse.json({ error: 'Failed to delete admin' }, { status: 500 })
  }
}
