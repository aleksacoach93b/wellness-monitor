import { isRhrQuestion } from '@/lib/rhr/options'
import { verifyRhrAnswer } from '@/lib/rhr/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { parsePvtAnswer } from '@/lib/pvt/options'
import { equalSecret, hashToken } from '@/lib/pvt/server'
import { summarizePvt, validatePvtRecord, type PvtResult } from '@/lib/pvt/protocol'

const submitResponseSchema = z.object({
  surveyId: z.string(),
  playerId: z.string().optional().nullable(),
  playerName: z.string().optional().nullable(),
  playerEmail: z.string().optional().nullable(),
  sessionType: z.string().trim().min(1).optional().nullable(),
  matchDay: z.string().trim().min(1).optional().nullable(),
  answers: z.array(z.object({
    questionId: z.string(),
    value: z.coerce.string(),
  })),
  bodyMapData: z
    .record(
      z.string(),
      z.union([
        z.number(),
        z.object({
          rating: z.number(),
          location: z.string(),
          when: z.array(z.string()).optional(),
        }),
      ])
    )
    .optional()
    .nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const data = submitResponseSchema.parse(await request.json())
    const survey = await prisma.survey.findUnique({ where: { id: data.surveyId }, include: { questions: true } })
    if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    const questionIds = new Set(survey.questions.map(q => q.id))
    if (data.answers.some(a => !questionIds.has(a.questionId)) || new Set(data.answers.map(a => a.questionId)).size !== data.answers.length) return NextResponse.json({ error: 'Invalid survey questions' }, { status: 400 })
    if (data.playerId && !await prisma.player.findFirst({ where: { id: data.playerId, teamId: survey.teamId, isActive: true } })) return NextResponse.json({ error: 'Player not found' }, { status: 400 })
    const sessionType = data.sessionType?.trim() || null
    const matchDay = data.matchDay?.trim() || null
    const response = await prisma.$transaction(async tx => {
      if (data.playerId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${survey.id}:${data.playerId}:${sessionType || ''}`}))`
      const answers = [...data.answers.map(a => ({ ...a }))]
      const attempts: string[] = []
      for (const question of survey.questions.filter(q => q.type === 'PVT')) {
        const answer = answers.find(a => a.questionId === question.id)
        if (!answer?.value) {
          if (question.required) throw new Error('PVT_REQUIRED')
          continue
        }
        const receipt = parsePvtAnswer(answer.value)
        const attempt = receipt && await tx.pvtSession.findFirst({ where: { id: receipt.attemptId, surveyId: survey.id, questionId: question.id, playerId: data.playerId || '__missing__', practice: false } })
        if (!receipt?.token || !attempt?.finishedAt || !equalSecret(hashToken(receipt.token), attempt.tokenHash) || Date.now() - attempt.startedAt.getTime() > 48 * 3600_000) throw new Error('PVT_INVALID')
        if (attempt.status !== 'COMPLETED') throw new Error('PVT_REPEAT_REQUIRED', { cause: question.id })
        // Recheck the raw record as well: a receipt from an older browser must
        // not bypass the current rules, even if it previously said COMPLETED.
        const rawResult = attempt.raw as PvtResult | null
        if (!rawResult || !Array.isArray(rawResult.trials) || !validatePvtRecord(rawResult, attempt.durationSeconds, attempt.protocolVersion)) throw new Error('PVT_INVALID')
        const summary = summarizePvt(rawResult, attempt.durationSeconds, attempt.protocolVersion)
        if (summary.repeatRequired) throw new Error('PVT_REPEAT_REQUIRED', { cause: question.id })
        // Only server-computed metrics are stored in the answer. Never persist access tokens there.
        answer.value = JSON.stringify({ kind: 'PVT', attemptId: attempt.id, durationSeconds: attempt.durationSeconds, protocolVersion: attempt.protocolVersion, medianRT: summary?.medianRT, responses: summary?.responses, falseStarts: summary?.falseStarts, quality: summary?.quality, flags: summary?.flags })
        attempts.push(attempt.id)
      }
      for (const question of survey.questions.filter(isRhrQuestion)) {
        const answer=answers.find(a=>a.questionId===question.id)
        if(!answer?.value){if(question.required)throw new Error('RHR_REQUIRED');continue}
        const verified=await verifyRhrAnswer(answer.value,{surveyId:survey.id,playerId:data.playerId||'',questionId:question.id})
        if(!verified)throw new Error('RHR_INVALID', {cause:question.id})
        answer.value=JSON.stringify(verified)
      }
      // Preserve the existing one-response-per-day/session behavior atomically.
      // Attempt history survives replacement through the nullable SetNull relation.
      if (data.playerId) {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
        await tx.response.deleteMany({ where: { surveyId: survey.id, playerId: data.playerId, sessionType, submittedAt: { gte: today, lt: tomorrow } } })
      }
      const saved = await tx.response.create({ data: {
        surveyId: survey.id, playerId: data.playerId || null, playerName: data.playerName || null, playerEmail: data.playerEmail || null, sessionType, matchDay,
        answers: { create: answers.map(a => ({ questionId: a.questionId, value: a.value })) },
      }, include: { answers: { include: { question: true } } } })
      if (attempts.length) await tx.pvtSession.updateMany({ where: { id: { in: attempts } }, data: { responseId: saved.id } })
      return saved
    }, { timeout: 15000 })
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('RHR_')) return NextResponse.json({rhrQuestionId:typeof error.cause==='string'?error.cause:undefined,error:error.message==='RHR_REQUIRED'?'Complete the required resting HR measurement before submitting.':'Resting HR could not be verified. Measure again before submitting.'},{status:400})
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
    if (error instanceof Error && error.message.startsWith('PVT_')) return NextResponse.json({ focusQuestionId: error.message === 'PVT_REPEAT_REQUIRED' && typeof error.cause === 'string' ? error.cause : undefined, error: error.message === 'PVT_REQUIRED' ? 'Complete the required Focus test before submitting.' : error.message === 'PVT_REPEAT_REQUIRED' ? 'Repeat the Focus test: this attempt did not meet the completion rules.' : 'Focus test could not be verified. Reopen the question and save the test first.' }, { status: 400 })
    console.error('Survey submission failed', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Failed to submit response' }, { status: 500 })
  }
}
