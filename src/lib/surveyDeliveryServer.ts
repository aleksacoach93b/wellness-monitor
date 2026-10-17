import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
let ready: Promise<void> | null = null
export function ensureSurveyDeliverySchema() {
  if (!ready)
    ready = (async () => {
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "survey_submission_receipts" (
   "id" TEXT PRIMARY KEY, "surveyId" TEXT NOT NULL, "playerId" TEXT, "sessionType" TEXT,
   "requestHash" TEXT NOT NULL, "responseId" TEXT NOT NULL, "clientCreatedAt" TIMESTAMP(3) NOT NULL,
   "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "survey_submission_receipts_surveyId_playerId_createdAt_idx" ON "survey_submission_receipts"("surveyId","playerId","createdAt")',
      )
    })().catch((e) => {
      ready = null
      throw e
    })
  return ready
}
export function submissionHash(data: {
  surveyId: string
  playerId?: string | null
  playerName?: string | null
  playerEmail?: string | null
  sessionType?: string | null
  matchDay?: string | null
  clientCreatedAt?: string
  answers: { questionId: string; value: string }[]
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        surveyId: data.surveyId,
        playerId: data.playerId || null,
        playerName: data.playerName || null,
        playerEmail: data.playerEmail || null,
        sessionType: data.sessionType || null,
        matchDay: data.matchDay || null,
        clientCreatedAt: data.clientCreatedAt || null,
        answers: [...data.answers].sort((a, b) =>
          a.questionId.localeCompare(b.questionId),
        ),
      }),
    )
    .digest('hex')
}
