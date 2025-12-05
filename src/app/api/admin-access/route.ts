import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateAdminAccessSchema = z.object({
  password: z.string().min(1, 'Password is required')
})

export async function GET() {
  try {
    let settings = await prisma.adminAccessSettings.findFirst()

    if (!settings) {
      settings = await prisma.adminAccessSettings.create({
        data: { password: '123' }
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching admin access settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin access settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { password } = updateAdminAccessSchema.parse(body)

    let settings = await prisma.adminAccessSettings.findFirst()

    if (settings) {
      settings = await prisma.adminAccessSettings.update({
        where: { id: settings.id },
        data: { password }
      })
    } else {
      settings = await prisma.adminAccessSettings.create({
        data: { password }
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error updating admin access settings:', error)
    return NextResponse.json(
      { error: 'Failed to update admin access settings' },
      { status: 500 }
    )
  }
}

