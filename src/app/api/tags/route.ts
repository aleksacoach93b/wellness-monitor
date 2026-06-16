import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const CATEGORIES = ['SESSION', 'MATCHDAY'] as const

const createTagSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  category: z.enum(CATEGORIES),
})

// GET /api/tags            -> all active tags
// GET /api/tags?category=SESSION
// GET /api/tags?all=true   -> include inactive (admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const includeInactive = searchParams.get('all') === 'true'

    const tags = await prisma.tag.findMany({
      where: {
        ...(category && CATEGORIES.includes(category as (typeof CATEGORIES)[number])
          ? { category }
          : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ category: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(tags)
  } catch (error) {
    console.error('Error fetching tags:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}

// POST /api/tags  -> create a tag (appended to the end of its category)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createTagSchema.parse(body)

    const last = await prisma.tag.findFirst({
      where: { category: data.category },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const tag = await prisma.tag.create({
      data: {
        name: data.name,
        category: data.category,
        order: (last?.order ?? -1) + 1,
        isActive: true,
      },
    })

    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      )
    }
    console.error('Error creating tag:', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}
