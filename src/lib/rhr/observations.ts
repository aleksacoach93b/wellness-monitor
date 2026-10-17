import { prisma } from '@/lib/prisma'
import { measurementEnvironment } from '@/lib/measurementEnvironment'
import { zonedDay } from '@/lib/opsDates'
export { observationMeta, observationReport } from './observationProtocol'
let schemaPromise: Promise<void> | null = null
export async function ensureRhrObservations() {
  if (!schemaPromise)
    schemaPromise = (async () => {
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "rhr_observations" (
   "id" TEXT PRIMARY KEY, "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
   "surveyId" TEXT NOT NULL REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE,
   "questionId" TEXT NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
   "playerId" TEXT NOT NULL REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
   "localDate" TEXT NOT NULL, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
   "finishedAt" TIMESTAMP(3), "status" TEXT NOT NULL, "source" TEXT NOT NULL, "position" TEXT,
   "protocolVersion" TEXT NOT NULL, "acquisitionVersion" TEXT, "platform" TEXT NOT NULL,
   "browser" TEXT NOT NULL, "reason" TEXT, "bpm" INTEGER, "fps" DOUBLE PRECISION)`)
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "rhr_observations_teamId_surveyId_localDate_idx" ON "rhr_observations"("teamId","surveyId","localDate")',
      )
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "rhr_observations_playerId_surveyId_localDate_idx" ON "rhr_observations"("playerId","surveyId","localDate")',
      )
    })().catch((e) => {
      schemaPromise = null
      throw e
    })
  return schemaPromise
}
export type ObservationInput = {
  id: string
  teamId: string
  surveyId: string
  questionId: string
  playerId: string
  timezone: string
  status:
    | 'STARTED'
    | 'ACCEPTED'
    | 'REPEAT'
    | 'INTERRUPTED'
    | 'CAMERA_ERROR'
    | 'INCOMPLETE'
  source: 'SERVER' | 'CLIENT'
  position?: string
  protocolVersion: string
  acquisitionVersion?: string
  userAgent: string
  reason?: string
  bpm?: number
  fps?: number
  startedAt?: Date
}
/** Optional observability can fail without rejecting a player's measurement. */
export async function recordRhrObservation(input: ObservationInput) {
  try {
    await ensureRhrObservations()
    const { timezone, userAgent, ...data } = input
    const startedAt = input.startedAt ?? new Date()
    const row = {
      ...data,
      ...measurementEnvironment(userAgent),
      startedAt,
      localDate: zonedDay(startedAt, timezone),
      finishedAt: input.status === 'STARTED' ? null : new Date(),
    }
    await prisma.rhrObservation.createMany({
      data: [row],
      skipDuplicates: true,
    })
    if (input.status !== 'STARTED')
      await prisma.rhrObservation.updateMany({
        where: {
          id: input.id,
          teamId: input.teamId,
          surveyId: input.surveyId,
          playerId: input.playerId,
          questionId: input.questionId,
          status: { not: 'ACCEPTED' },
        },
        data: {
          status: input.status,
          source: input.source,
          finishedAt: row.finishedAt,
          reason: input.reason ?? null,
          bpm: input.bpm ?? null,
          fps: input.fps ?? null,
        },
      })
    return true
  } catch (error) {
    console.error(
      'Optional HR outcome tracking unavailable',
      error instanceof Error ? error.name : 'UnknownError',
    )
    return false
  }
}
