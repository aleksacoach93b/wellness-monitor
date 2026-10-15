import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import { durationSchema, localDay, pvtEnabled, sameOrigin } from '@/lib/pvt/server'

export const dynamic = 'force-dynamic'
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
export async function GET(request: NextRequest) {
  const admin = await getAdminSessionFromRequest(request)
  if (!admin) return reply({ error: 'Unauthorized' }, 401)
  const surveys = await prisma.survey.findMany({ where: { teamId: admin.teamId }, select: { id: true, title: true, timezone: true }, orderBy: { title: 'asc' } })
  if (!pvtEnabled()) return reply({ enabled: false, ready: false, surveys, configs: [], sessions: [] })
  try {
    const [configs, sessions] = await Promise.all([
      prisma.pvtConfig.findMany({ where: { teamId: admin.teamId }, select: { surveyId: true, enabled: true, durationSeconds: true } }),
      prisma.pvtSession.findMany({
        where: { teamId: admin.teamId, startedAt: { gte: new Date(Date.now() - 28 * 86400_000) } },
        select: { id: true, surveyId: true, playerId: true, startedAt: true, localDate: true, finishedAt: true, durationSeconds: true, protocolVersion: true, practice: true, status: true, deviceId: true, userAgent: true, context: true, summary: true, player: { select: { firstName: true, lastName: true } } },
        orderBy: { startedAt: 'asc' }, take: 5000,
      }),
    ])
    return reply({ enabled: true, ready: true, surveys, configs, sessions })
  } catch {
    return reply({ enabled: true, ready: false, surveys, configs: [], sessions: [], error: 'Apply the reviewed additive migration to a separate preview database first.' })
  }
}
export async function POST(request: NextRequest) {
  const admin = await getAdminSessionFromRequest(request)
  if (!admin) return reply({ error: 'Unauthorized' }, 401)
  if (!pvtEnabled()) return reply({ error: 'PVT feature flag is off.' }, 403)
  if (!sameOrigin(request)) return reply({ error: 'Invalid origin.' }, 403)
  try {
    const body = z.object({ surveyId: z.string(), enabled: z.boolean(), durationSeconds: durationSchema }).parse(await request.json())
    const survey = await prisma.survey.findFirst({ where: { id: body.surveyId, teamId: admin.teamId } })
    if (!survey) return reply({ error: 'Survey not found.' }, 404)
    return await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${survey.id}))`
      const old = await tx.pvtConfig.findUnique({ where: { surveyId: survey.id } })
      if (old && old.durationSeconds !== body.durationSeconds) {
        const started = await tx.pvtSession.count({ where: { surveyId: survey.id, localDate: localDay(new Date(), survey.timezone), practice: false } })
        if (started) return reply({ error: 'Duration is locked after the first official attempt of the day. Change it on a day before testing starts.' }, 409)
      }
      const config = await tx.pvtConfig.upsert({ where: { surveyId: survey.id }, create: { ...body, teamId: admin.teamId }, update: { enabled: body.enabled, durationSeconds: body.durationSeconds } })
      return reply({ saved: true, config: { surveyId: config.surveyId, enabled: config.enabled, durationSeconds: config.durationSeconds } })
    }, { timeout: 10_000 })
  } catch (error) {
    if (error instanceof z.ZodError) return reply({ error: 'Choose 60, 90 or 180 seconds.' }, 400)
    return reply({ error: 'PVT settings could not be saved.' }, 503)
  }
}
