import { randomBytes, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse, after } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  observationMeta,
  observationReport,
  recordRhrObservation,
} from '@/lib/rhr/observations'
import { hasPlayerGrant } from '@/lib/pvt/playerAuth'
import {
  equalSecret,
  hashToken,
  sameOrigin,
  surveyOpen,
} from '@/lib/pvt/server'
import {
  RHR_VERSION,
  RHR_FIXED_VERSION,
  RHR_RESTORED_VERSION,
  RHR_FIXED_ALGORITHM_VERSION,
  RHR_RESTORED_ALGORITHM_VERSION,
  RHR_ALGORITHM_VERSION,
  RHR_LEGACY_VERSION,
  RHR_LEGACY_ALGORITHM_VERSION,
} from '@/lib/rhr/protocol'
import { analyzeRhrRecord } from '@/lib/rhr/session'
import { isRhrQuestion, type RhrAnswer } from '@/lib/rhr/options'
import {
  rhrContextSchema,
  rhrRecordSchema,
  rhrTicket,
  readRhrTicket,
  signRhrResult,
} from '@/lib/rhr/server'
export const dynamic = 'force-dynamic'
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const schema = z.discriminatedUnion('action', [
  observationReport,
  z.object({
    action: z.literal('start'),
    protocolVersion: z
      .enum([
        RHR_VERSION,
        RHR_LEGACY_VERSION,
        RHR_FIXED_VERSION,
        RHR_RESTORED_VERSION,
      ])
      .optional(),
    playerId: z.string().min(1).max(100),
    questionId: z.string().min(1).max(100),
    password: z.string().max(100).optional(),
    context: rhrContextSchema,
    observation: observationMeta.optional(),
  }),
  z.object({
    action: z.literal('finish'),
    ticket: z.string().max(5000),
    record: rhrRecordSchema,
  }),
])
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  if (!sameOrigin(request)) return json({ error: 'Invalid origin.' }, 403)
  try {
    const { surveyId } = await params,
      raw = await request.text()
    if (raw.length > 1_000_000) return json({ error: 'Record too large.' }, 413)
    const body = schema.parse(JSON.parse(raw))
    if (body.action === 'report') {
      const survey = await prisma.survey.findUnique({
        where: { id: surveyId },
        include: { questions: true },
      })
      if (
        !survey?.teamId ||
        !surveyOpen(survey) ||
        !survey.questions.some(
          (q) => q.id === body.questionId && isRhrQuestion(q),
        )
      )
        return json({ error: 'Measurement unavailable.' }, 403)
      const window = Math.floor(Date.now() / 600000)
      const rate = await prisma.pvtAuthWindow.upsert({
        where: {
          key: hashToken(`rhr-report:${surveyId}:${body.playerId}:${window}`),
        },
        create: {
          key: hashToken(`rhr-report:${surveyId}:${body.playerId}:${window}`),
          expiresAt: new Date((window + 1) * 600000),
        },
        update: { attempts: { increment: 1 } },
      })
      if (rate.attempts > 50)
        return json({ error: 'Too many outcome reports.' }, 429)
      const player = await prisma.player.findFirst({
        where: { id: body.playerId, teamId: survey.teamId, isActive: true },
      })
      const expected = player
        ? player.password ||
          `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`
        : randomBytes(16).toString('hex')
      if (
        !player ||
        (!(await hasPlayerGrant(request, player.id, surveyId)) &&
          !equalSecret(
            (body.password || '').toUpperCase(),
            expected.toUpperCase(),
          ))
      )
        return json({ error: 'Unauthorized outcome report.' }, 401)
      const recorded = await recordRhrObservation({
        id: body.eventId,
        teamId: survey.teamId,
        surveyId,
        playerId: player.id,
        questionId: body.questionId,
        timezone: survey.timezone,
        status: body.status,
        source: 'CLIENT',
        position: body.position,
        protocolVersion: body.protocolVersion,
        acquisitionVersion: body.acquisitionVersion,
        userAgent: request.headers.get('user-agent') || '',
        reason: body.reason,
      })
      return json({ recorded })
    }
    if (body.action === 'finish') {
      let ticket
      try {
        ticket = await readRhrTicket(body.ticket)
      } catch {
        return json(
          { error: 'Measurement session expired. Start a new scan.' },
          401,
        )
      }
      if (
        ticket.surveyId !== surveyId ||
        ![
          RHR_VERSION,
          RHR_LEGACY_VERSION,
          RHR_FIXED_VERSION,
          RHR_RESTORED_VERSION,
        ].includes(String(ticket.version)) ||
        ticket.version !==
          (body.record.protocolVersion ?? RHR_LEGACY_VERSION) ||
        !ticket.iat
      )
        return json({ error: 'Invalid measurement session.' }, 401)
      const context = rhrContextSchema.parse({
        position: ticket.position,
        rested: ticket.rested,
      })
      if (Date.now() - ticket.iat * 1000 + 1000 < body.record.elapsedMs)
        return json({ error: 'Invalid measurement timing.' }, 400)
      const [survey, player] = await Promise.all([
        prisma.survey.findUnique({
          where: { id: surveyId },
          include: { questions: true },
        }),
        prisma.player.findUnique({ where: { id: String(ticket.playerId) } }),
      ])
      if (
        !survey ||
        !player?.isActive ||
        player.teamId !== survey.teamId ||
        !survey.questions.some(
          (q) => q.id === ticket.questionId && isRhrQuestion(q),
        )
      )
        return json({ error: 'Measurement is no longer available.' }, 403)
      const analysis = analyzeRhrRecord(body.record)
      if (typeof ticket.measurementId === 'string' && survey.teamId) {
        const measurementId = ticket.measurementId,
          startedAt = new Date(ticket.iat * 1000)
        after(async () => {
          await recordRhrObservation({
            id: measurementId,
            teamId: survey.teamId!,
            surveyId,
            playerId: player.id,
            questionId: String(ticket.questionId),
            timezone: survey.timezone,
            status:
              analysis.quality === 'ACCEPTED' && analysis.bpm !== null
                ? 'ACCEPTED'
                : body.record.interruption
                  ? 'INTERRUPTED'
                  : 'REPEAT',
            source: 'SERVER',
            position: context.position,
            protocolVersion: String(ticket.version),
            acquisitionVersion:
              typeof ticket.acquisitionVersion === 'string'
                ? ticket.acquisitionVersion
                : undefined,
            userAgent: request.headers.get('user-agent') || '',
            reason: analysis.reasons[0],
            bpm: analysis.bpm ?? undefined,
            fps: analysis.fps,
            startedAt,
          })
        })
      }
      if (analysis.quality !== 'ACCEPTED' || analysis.bpm === null)
        return json({ accepted: false, analysis })
      const result: RhrAnswer = {
        kind: 'RHR',
        bpm: analysis.bpm,
        position: context.position,
        rested: true,
        durationSeconds:
          ticket.version === RHR_VERSION
            ? Math.round(body.record.elapsedMs / 100) / 10
            : 15,
        protocolVersion: String(ticket.version),
        algorithmVersion:
          ticket.version === RHR_RESTORED_VERSION
            ? RHR_RESTORED_ALGORITHM_VERSION
            : ticket.version === RHR_FIXED_VERSION
              ? RHR_FIXED_ALGORITHM_VERSION
              : ticket.version === RHR_VERSION
                ? RHR_ALGORITHM_VERSION
                : RHR_LEGACY_ALGORITHM_VERSION,
        ...(ticket.version === RHR_VERSION
          ? {
              targetDurationSeconds: 15 as const,
              detectionSeconds: 5 as const,
              stableWindowSeconds: 10 as const,
              restarts: analysis.restarts!,
            }
          : {}),
        ...([RHR_FIXED_VERSION, RHR_RESTORED_VERSION].includes(
          String(ticket.version),
        )
          ? { targetDurationSeconds: 15 as const, restarts: 0 }
          : {}),
        measuredAt: new Date(
          ticket.iat * 1000 + body.record.elapsedMs,
        ).toISOString(),
        quality: 'ACCEPTED',
        torch: body.record.torch,
        fps: Math.round(analysis.fps * 10) / 10,
        beats: analysis.beats,
        correlation: analysis.correlation!,
      }
      const receipt = await signRhrResult(result, {
        surveyId,
        playerId: player.id,
        questionId: String(ticket.questionId),
      })
      return json({ accepted: true, result: { ...result, receipt } })
    }
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: { questions: true },
    })
    if (
      !survey?.teamId ||
      !surveyOpen(survey) ||
      !survey.questions.some(
        (q) => q.id === body.questionId && isRhrQuestion(q),
      )
    )
      return json({ error: 'Resting HR measurement is not open.' }, 403)
    const window = Math.floor(Date.now() / 600000)
    const rate = await prisma.pvtAuthWindow.upsert({
      where: { key: hashToken(`rhr:${surveyId}:${body.playerId}:${window}`) },
      create: {
        key: hashToken(`rhr:${surveyId}:${body.playerId}:${window}`),
        expiresAt: new Date((window + 1) * 600000),
      },
      update: { attempts: { increment: 1 } },
    })
    if (rate.attempts > 10)
      return json({ error: 'Too many starts. Wait ten minutes.' }, 429)
    const player = await prisma.player.findFirst({
      where: { id: body.playerId, teamId: survey.teamId, isActive: true },
    })
    const expected = player
      ? player.password ||
        `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`
      : randomBytes(16).toString('hex')
    if (
      !player ||
      (!(await hasPlayerGrant(request, player.id, surveyId)) &&
        !equalSecret(
          (body.password || '').toUpperCase(),
          expected.toUpperCase(),
        ))
    )
      return json({ error: 'Enter your player access code.' }, 401)
    const measurementId = body.observation?.id ?? randomUUID()
    after(async () => {
      await recordRhrObservation({
        id: measurementId,
        teamId: survey.teamId!,
        surveyId,
        questionId: body.questionId,
        playerId: player.id,
        timezone: survey.timezone,
        status: 'STARTED',
        source: 'SERVER',
        position: body.context.position,
        protocolVersion: body.protocolVersion ?? RHR_LEGACY_VERSION,
        acquisitionVersion: body.observation?.acquisitionVersion,
        userAgent: request.headers.get('user-agent') || '',
      })
    })
    return json({
      ticket: await rhrTicket({
        measurementId,
        acquisitionVersion: body.observation?.acquisitionVersion,
        playerId: player.id,
        surveyId,
        questionId: body.questionId,
        ...body.context,
        protocolVersion: body.protocolVersion ?? RHR_LEGACY_VERSION,
      }),
    })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json({ error: 'Invalid measurement request.' }, 400)
    console.error(
      'RHR unavailable',
      error instanceof Error ? error.name : 'UnknownError',
    )
    return json(
      {
        error:
          'Unable to save this measurement. Your wellness answers are unaffected.',
      },
      503,
    )
  }
}
