import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const kioskThemeSchema = z.enum(['dark', 'light', 'red', 'green', 'sky', 'graphite', 'sand', 'violet'])

const updateKioskSettingsSchema = z.object({
  password: z.string(),
  coachPassword: z.string().optional(),
  isEnabled: z.boolean(),
  theme: kioskThemeSchema.default('dark'),
  clubName: z.string().max(120).optional(),
  clubLogo: z.string().nullable().optional(),
  showClubBranding: z.boolean().optional(),
})

export async function GET() {
  try {
    let settings = await prisma.kioskSettings.findFirst()

    if (!settings) {
      settings = await prisma.kioskSettings.create({
        data: {
          password: '',
          isEnabled: false,
          theme: 'dark',
          clubName: '',
          showClubBranding: true,
        },
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
    const parsed = updateKioskSettingsSchema.parse(body)
    const { password, coachPassword, isEnabled, theme, clubName, clubLogo, showClubBranding } = parsed

    let settings = await prisma.kioskSettings.findFirst()

    const data: Record<string, unknown> = { password, isEnabled, theme }
    if (coachPassword !== undefined) data.coachPassword = coachPassword
    if (clubName !== undefined) data.clubName = clubName.trim()
    if (clubLogo !== undefined) data.clubLogo = clubLogo
    if (showClubBranding !== undefined) data.showClubBranding = showClubBranding

    if (settings) {
      settings = await prisma.kioskSettings.update({
        where: { id: settings.id },
        data,
      })
    } else {
      settings = await prisma.kioskSettings.create({
        data: {
          password,
          isEnabled,
          theme,
          coachPassword: coachPassword ?? '',
          clubName: clubName?.trim() ?? '',
          clubLogo: clubLogo ?? null,
          showClubBranding: showClubBranding ?? true,
        },
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
