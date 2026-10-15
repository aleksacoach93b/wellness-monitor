import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { PVT_VERSION, summarizePvt, validatePvtRecord } from '@/lib/pvt/protocol'
import { contextSchema, equalSecret, hashToken, localDay, pvtEnabled, resultSchema, sameOrigin, surveyOpen } from '@/lib/pvt/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type RouteContext = { params: Promise<{ surveyId: string }> }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const startSchema = z.object({ action: z.literal('start'), playerId: z.string().min(1).max(100), password: z.string().max(100), practice: z.boolean(), context: contextSchema })
const finishSchema = z.object({ action: z.literal('finish'), id: z.string().min(1).max(100), token: z.string().length(64), result: resultSchema })

export async function GET(_request: NextRequest, { params }: RouteContext) {
  if (!pvtEnabled()) return json({ enabled: false })
  try {
    const { surveyId } = await params
    const config = await prisma.pvtConfig.findUnique({ where: { surveyId }, include: { survey: true } })
    if (!config?.enabled || !surveyOpen(config.survey)) return json({ enabled: false })
    return json({ enabled: true, duration: config.durationSeconds, version: PVT_VERSION })
  } catch {
    // Optional module must not break existing surveys before its migration is applied.
    return json({ enabled: false })
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  if (!pvtEnabled()) return json({ error: 'PVT is disabled.' }, 404)
  if (!sameOrigin(request)) return json({ error: 'Invalid origin.' }, 403)
  try {
    const { surveyId } = await params
    const raw = await request.text()
    if (raw.length > 300_000) return json({ error: 'Record too large.' }, 413)
    const body = z.discriminatedUnion('action', [startSchema, finishSchema]).parse(JSON.parse(raw))
    if (body.action === 'finish') {
      const session = await prisma.pvtSession.findFirst({ where: { id: body.id, surveyId } })
      if (!session || !equalSecret(hashToken(body.token), session.tokenHash)) return json({ error: 'Invalid test session.' }, 401)
      // A successful retry returns the first stored record; it can never overwrite it.
      if (session.finishedAt) return json({ saved: true, summary: session.summary })
      const age = Date.now() - session.startedAt.getTime()
      if (age > 30 * 60_000) return json({ error: 'Session expired. Ask your coach before repeating.' }, 409)
      if (age + 1000 < body.result.elapsedMs || !validatePvtRecord(body.result, session.durationSeconds)) return json({ error: 'Invalid timing record.' }, 400)
      const summary = summarizePvt(body.result, session.durationSeconds)
      await prisma.pvtSession.updateMany({
        where: { id: session.id, finishedAt: null },
        data: { status: body.result.interruption ? 'INTERRUPTED' : 'COMPLETED', finishedAt: new Date(), raw: body.result as unknown as Prisma.InputJsonValue, summary: summary as Prisma.InputJsonValue },
      })
      const saved = await prisma.pvtSession.findUnique({ where: { id: session.id }, select: { summary: true } })
      return json({ saved: true, summary: saved?.summary })
    }
    return await prisma.$transaction(async tx => {
      // Serialise official starts and coach setting changes for this survey.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${surveyId}))`
      const config = await tx.pvtConfig.findUnique({ where: { surveyId }, include: { survey: true } })
      if (!config?.enabled || !surveyOpen(config.survey)) return json({ error: 'Testing is not open.' }, 403)
      const now = Date.now()
      const window = Math.floor(now / 600_000)
      const rate = await tx.pvtAuthWindow.upsert({
        where: { key: hashToken(`${surveyId}:${body.playerId}:${window}`) },
        create: { key: hashToken(`${surveyId}:${body.playerId}:${window}`), expiresAt: new Date((window + 1) * 600_000) },
        update: { attempts: { increment: 1 } },
      })
      if (rate.attempts > 10) return json({ error: 'Too many attempts. Wait ten minutes.' }, 429)
      const player = await tx.player.findFirst({ where: { id: body.playerId, teamId: config.teamId, isActive: true } })
      const expected = player ? (player.password || `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`) : randomBytes(16).toString('hex')
      if (!player || !equalSecret(body.password.toUpperCase(), expected.toUpperCase())) return json({ error: 'Incorrect player access code.' }, 401)
      const token = randomBytes(32).toString('hex')
      const session = await tx.pvtSession.create({ data: {
        teamId: config.teamId, surveyId, playerId: player.id, tokenHash: hashToken(token),
        durationSeconds: body.practice ? 60 : config.durationSeconds, protocolVersion: PVT_VERSION, practice: body.practice,
        localDate: localDay(new Date(), config.survey.timezone), deviceId: body.context.deviceId,
        userAgent: (request.headers.get('user-agent') || '').slice(0, 500), context: body.context,
      } })
      return json({ id: session.id, token, duration: session.durationSeconds, version: PVT_VERSION })
    }, { timeout: 10_000 })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: 'Invalid request.' }, 400)
    console.error('PVT request failed', error instanceof Error ? error.name : 'UnknownError')
    return json({ error: 'PVT is unavailable. Your wellness answers are unaffected.' }, 503)
  }
}
