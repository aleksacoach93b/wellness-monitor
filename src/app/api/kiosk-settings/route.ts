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

/** Self-heal when production DB was deployed without prisma db push */
async function ensureClubBrandingColumns() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "kiosk_settings"
    ADD COLUMN IF NOT EXISTS "clubName" TEXT NOT NULL DEFAULT '';
  `)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "kiosk_settings"
    ADD COLUMN IF NOT EXISTS "clubLogo" TEXT;
  `)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "kiosk_settings"
    ADD COLUMN IF NOT EXISTS "showClubBranding" BOOLEAN NOT NULL DEFAULT true;
  `)
}

export async function GET() {
  try {
    await ensureClubBrandingColumns()
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
    await ensureClubBrandingColumns()
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
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to update kiosk settings'
    // Common production cause: schema columns missing until prisma db push
    const hint =
      /clubName|clubLogo|showClubBranding|Unknown arg|column/i.test(message)
        ? ' Database schema may be out of date — redeploy so prisma db push runs.'
        : ''
    return NextResponse.json(
      { error: `Failed to update kiosk settings.${hint}`, details: message },
      { status: 500 }
    )
  }
}
