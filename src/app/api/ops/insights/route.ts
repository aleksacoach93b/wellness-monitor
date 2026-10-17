import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import { ensureRhrObservations } from '@/lib/rhr/observations'
import {
  buildOpsInsights,
  type InsightFocus,
  type InsightHr,
} from '@/lib/opsInsights'
import { validDay, shiftDay, zonedDay, recentDays } from '@/lib/opsDates'
import {
  indexResponsesByPlayerDay,
  buildOpsDayPayload,
} from '@/lib/opsDayBuild'
import { loadOpsQuestionMappings } from '@/lib/opsTablePrefs'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sid = request.nextUrl.searchParams.get('surveyId'),
    dateParam = request.nextUrl.searchParams.get('date')
  if (!sid || (dateParam && !validDay(dateParam)))
    return NextResponse.json(
      { error: 'A valid survey and date are required.' },
      { status: 400 },
    )
  try {
    const survey = await prisma.survey.findFirst({
      where: { id: sid, teamId: session.teamId },
      select: {
        id: true,
        timezone: true,
        questions: {
          select: {
            id: true,
            text: true,
            type: true,
            options: true,
            createdAt: true,
          },
        },
      },
    })
    if (!survey)
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    const now = new Date(),
      date = dateParam || zonedDay(now, survey.timezone),
      first = shiftDay(date, -42)
    // Broad UTC window, then exact survey-timezone day filtering below (including DST).
    const [players, responses] = await Promise.all([
      prisma.player.findMany({
        where: { teamId: session.teamId, isActive: true },
        select: { id: true, firstName: true, lastName: true, image: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      prisma.response.findMany({
        where: {
          surveyId: sid,
          survey: { teamId: session.teamId },
          submittedAt: {
            gte: new Date(shiftDay(first, -1) + 'T00:00:00Z'),
            lt: new Date(shiftDay(date, 2) + 'T00:00:00Z'),
          },
          playerId: { not: null },
        },
        select: {
          id: true,
          playerId: true,
          submittedAt: true,
          answers: {
            select: {
              questionId: true,
              value: true,
              question: {
                select: { id: true, text: true, type: true, options: true },
              },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      }),
    ])
    let hrTrackingAvailable = true,
      focusAvailable = true,
      hr: InsightHr[] = [],
      focus: InsightFocus[] = []
    try {
      await ensureRhrObservations()
      hr = await prisma.rhrObservation.findMany({
        where: {
          teamId: session.teamId,
          surveyId: sid,
          localDate: { gte: shiftDay(date, -13), lte: date },
        },
        orderBy: { startedAt: 'asc' },
      })
    } catch {
      hrTrackingAvailable = false
    }
    try {
      focus = await prisma.pvtSession.findMany({
        where: {
          teamId: session.teamId,
          surveyId: sid,
          localDate: { gte: shiftDay(date, -14), lte: date },
          practice: false,
        },
        select: {
          id: true,
          responseId: true,
          playerId: true,
          questionId: true,
          localDate: true,
          startedAt: true,
          finishedAt: true,
          status: true,
          practice: true,
          durationSeconds: true,
          protocolVersion: true,
          deviceId: true,
          userAgent: true,
          context: true,
          summary: true,
        },
        orderBy: { startedAt: 'asc' },
      })
    } catch {
      focusAvailable = false
    }
    const scoped = responses.filter((r) => {
      const d = zonedDay(r.submittedAt, survey.timezone)
      return d >= first && d <= date
    })
    const mappings = await loadOpsQuestionMappings({
      teamId: session.teamId,
      adminUserId: session.sub,
      surveyId: sid,
    }).catch(() => ({}))
    const index = indexResponsesByPlayerDay(
      scoped,
      { questionMappings: mappings },
      survey.timezone,
    )
    const wellnessDays = Object.fromEntries(
      recentDays(date, 14).map((d) => [
        d,
        buildOpsDayPayload({ players, ...index, selectedDate: d }),
      ]),
    )
    const payload = buildOpsInsights({
      players: players.map(({ id, firstName, lastName }) => ({
        id,
        firstName,
        lastName,
      })),
      questions: survey.questions,
      responses: scoped,
      focus,
      hr,
      date,
      timezone: survey.timezone,
      now,
      hrTrackingAvailable,
      focusAvailable,
      wellnessDays,
    })
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error(
      'Ops insights unavailable',
      error instanceof Error ? error.name : 'UnknownError',
    )
    return NextResponse.json(
      {
        error:
          'Monitoring report could not be loaded. Your daily wellness data is unaffected.',
      },
      { status: 503 },
    )
  }
}
