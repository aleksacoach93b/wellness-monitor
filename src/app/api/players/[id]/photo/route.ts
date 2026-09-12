import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const PHOTO_HEADERS = {
  'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
  'Access-Control-Allow-Origin': '*',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const player = await prisma.player.findUnique({
      where: { id },
      select: { image: true },
    })

    const image = player?.image?.trim() || ''
    if (!image) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    if (/^https?:\/\//i.test(image)) {
      return NextResponse.redirect(image, 302)
    }

    const dataUrl = image.match(/^data:([^;]+);base64,(.+)$/)
    if (!dataUrl) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    const contentType = dataUrl[1] || 'image/jpeg'
    const body = Buffer.from(dataUrl[2], 'base64')

    return new NextResponse(body, {
      status: 200,
      headers: {
        ...PHOTO_HEADERS,
        'Content-Type': contentType,
        'Content-Length': String(body.length),
      },
    })
  } catch (error) {
    console.error('Error serving player photo:', error)
    return NextResponse.json({ error: 'Failed to load photo' }, { status: 500 })
  }
}
