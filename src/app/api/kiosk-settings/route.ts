import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const kioskThemeSchema = z.enum(['dark', 'light', 'red', 'green'])

const updateKioskSettingsSchema = z.object({
  password: z.string(),
  coachPassword: z.string().optional(),
  isEnabled: z.boolean(),
  theme: kioskThemeSchema.default('dark')
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
          isEnabled: false,
          theme: 'dark'
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
    console.log('Received kiosk settings update:', body)
    const { password, coachPassword, isEnabled, theme } = updateKioskSettingsSchema.parse(body)
    console.log('Parsed data:', { password, isEnabled, theme, coachPassword: coachPassword !== undefined ? '***' : 'unchanged' })
    
    // Get the first (and only) kiosk settings record
    let settings = await prisma.kioskSettings.findFirst()
    
    const data: Record<string, unknown> = { password, isEnabled, theme }
    if (coachPassword !== undefined) data.coachPassword = coachPassword

    if (settings) {
      settings = await prisma.kioskSettings.update({
        where: { id: settings.id },
        data
      })
      console.log('Updated existing settings:', settings.id)
    } else {
      settings = await prisma.kioskSettings.create({
        data: { password, isEnabled, theme, coachPassword: coachPassword ?? '' }
      })
      console.log('Created new settings:', settings.id)
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
