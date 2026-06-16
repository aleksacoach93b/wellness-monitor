import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().optional(),
})

// PUT /api/tags/:id  -> rename / toggle active / reorder
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await prisma.tag.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tag:', error)
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 })
  }
}
