import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { PVT_VERSION, summarizePvt, validatePvtRecord } from '@/lib/pvt/protocol'
import { pvtDuration } from '@/lib/pvt/options'
import { hasPlayerGrant, playerGrant, PVT_PLAYER_COOKIE } from '@/lib/pvt/playerAuth'
import { contextSchema, equalSecret, hashToken, localDay, pvtEnabled, resultSchema, sameOrigin, surveyOpen } from '@/lib/pvt/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type RouteContext = { params: Promise<{ surveyId: string }> }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const startSchema = z.object({ action: z.literal('start'), protocolVersion: z.literal(PVT_VERSION), playerId: z.string().min(1).max(100), password: z.string().max(100).optional(), questionId: z.string().min(1), practice: z.boolean(), context: contextSchema })
const authorizeSchema = z.object({ action: z.literal('authorize'), playerId: z.string().min(1).max(100), password: z.string().max(100) })
const finishSchema = z.object({ action: z.literal('finish'), id: z.string().min(1).max(100), token: z.string().length(64), result: resultSchema })

export async function GET(_request: NextRequest, { params }: RouteContext) {
  if (!pvtEnabled()) return json({ enabled: false })
  try {
    const { surveyId } = await params
    const survey = await prisma.survey.findUnique({ where: { id: surveyId }, include: { questions: { where: { type: 'PVT' } } } })
    return json({ enabled: !!survey && surveyOpen(survey), questions: survey?.questions.map(q => ({ id: q.id, duration: pvtDuration(q.options) })) || [], version: PVT_VERSION })
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
    const body = z.discriminatedUnion('action', [startSchema, finishSchema, authorizeSchema]).parse(JSON.parse(raw))
    if (body.action === 'finish') {
      const session = await prisma.pvtSession.findFirst({ where: { id: body.id, surveyId } })
      if (!session || !equalSecret(hashToken(body.token), session.tokenHash)) return json({ error: 'Invalid test session.' }, 401)
      // A successful retry returns the first stored record; it can never overwrite it.
      if (session.finishedAt) return json({ saved: true, summary: session.summary })
      const age = Date.now() - session.startedAt.getTime()
      if (age > 30 * 60_000) return json({ error: 'Session expired. Ask your coach before repeating.' }, 409)
      if (age + 1000 < body.result.elapsedMs || !validatePvtRecord(body.result, session.durationSeconds, session.protocolVersion)) return json({ error: 'Invalid timing record.' }, 400)
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
      const survey = await tx.survey.findUnique({ where: { id: surveyId }, include: { questions: { where: { type: 'PVT' } } } })
      if (!survey?.teamId || !surveyOpen(survey)) return json({ error: 'Testing is not open.' }, 403)
      const now = Date.now()
      const window = Math.floor(now / 600_000)
      const rate = await tx.pvtAuthWindow.upsert({
        where: { key: hashToken(`${surveyId}:${body.playerId}:${window}`) },
        create: { key: hashToken(`${surveyId}:${body.playerId}:${window}`), expiresAt: new Date((window + 1) * 600_000) },
        update: { attempts: { increment: 1 } },
      })
      if (rate.attempts > 10) return json({ error: 'Too many attempts. Wait ten minutes.' }, 429)
      const player = await tx.player.findFirst({ where: { id: body.playerId, teamId: survey.teamId, isActive: true } })
      const expected = player ? (player.password || `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`) : randomBytes(16).toString('hex')
      if (!player || (!(body.action === 'start' && await hasPlayerGrant(request, body.playerId, surveyId)) && !equalSecret((body.password || '').toUpperCase(), expected.toUpperCase()))) return json({ error: 'Incorrect player access code.' }, 401)
      if (body.action === 'authorize') {
        const grant = await playerGrant(player.id, surveyId)
        const response = json({ authorized: true })
        if (grant) response.cookies.set(PVT_PLAYER_COOKIE, grant, { httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 7200 })
        return response
      }
      const question = survey.questions.find(q => q.id === body.questionId)
      if (!question) return json({ error: 'Focus question not found.' }, 404)
      const localDate = localDay(new Date(), survey.timezone)
      const first = await tx.pvtSession.findFirst({ where: { questionId: question.id, localDate, practice: false }, orderBy: { startedAt: 'asc' } })
      const duration = first?.durationSeconds ?? pvtDuration(question.options)
      const token = randomBytes(32).toString('hex')
      const session = await tx.pvtSession.create({ data: {
        questionId: question.id, questionLabel: question.text, teamId: survey.teamId, surveyId, playerId: player.id, tokenHash: hashToken(token),
        durationSeconds: body.practice ? 30 : duration, protocolVersion: PVT_VERSION, practice: body.practice,
        localDate, deviceId: body.context.deviceId,
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
