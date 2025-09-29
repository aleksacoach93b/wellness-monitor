import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateKioskSettingsSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  isEnabled: z.boolean()
})

export async function GET() {
  try {
    // Get the first (and only) kiosk settings record
    let settings = await prisma.kioskSettings.findFirst()
    
    // If no settings exist, create default ones
    if (!settings) {
      settings = await prisma.kioskSettings.create({
        data: {
          password: '',
          isEnabled: false
        }
      })
    }
    
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching kiosk settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch kiosk settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { password, isEnabled } = updateKioskSettingsSchema.parse(body)
    
    // Get the first (and only) kiosk settings record
    let settings = await prisma.kioskSettings.findFirst()
    
    if (settings) {
      // Update existing settings
      settings = await prisma.kioskSettings.update({
        where: { id: settings.id },
        data: { password, isEnabled }
      })
    } else {
      // Create new settings
      settings = await prisma.kioskSettings.create({
        data: { password, isEnabled }
      })
    }
    
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error updating kiosk settings:', error)
    return NextResponse.json(
      { error: 'Failed to update kiosk settings' },
      { status: 500 }
    )
  }
}
