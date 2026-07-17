import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'

export const dynamic = 'force-dynamic'

const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().optional(),
})

async function assertTagAccess(teamId: string, tagId: string) {
  const tag = await prisma.tag.findFirst({
    where: { id: tagId, teamId },
    select: { id: true },
  })
  return Boolean(tag)
}

// PUT /api/tags/:id  -> rename / toggle active / reorder
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!(await assertTagAccess(session.teamId, id))) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = updateTagSchema.parse(body)

    const tag = await prisma.tag.update({
      where: { id },
      data,
    })

    return NextResponse.json(tag)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      )
    }
    console.error('Error updating tag:', error)
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 })
  }
}

// DELETE /api/tags/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!(await assertTagAccess(session.teamId, id))) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    await prisma.tag.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tag:', error)
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 })
  }
}
