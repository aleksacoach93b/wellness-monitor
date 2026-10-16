import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'
import { RHR_POSITIONS, RHR_VERSION, type RhrRecord } from './protocol'
import type { RhrAnswer } from './options'
const secret = () => {
  const value =
    process.env.ADMIN_JWT_SECRET ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET
  if (!value) throw new Error('RHR signing unavailable')
  return new TextEncoder().encode(value)
}
export const rhrContextSchema = z.object({
  position: z.enum(RHR_POSITIONS),
  rested: z.literal(true),
})
export const rhrRecordSchema = z.object({
  elapsedMs: z.number().finite().min(0).max(15000),
  interruption: z
    .enum(['hidden', 'blur', 'cancelled', 'camera-ended', 'orientation'])
    .nullable(),
  torch: z.boolean(),
  samples: z
    .array(
      z.object({
        t: z.number().finite().nonnegative(),
        r: z.number().finite().min(0).max(255),
        g: z.number().finite().min(0).max(255),
        b: z.number().finite().min(0).max(255),
        clipped: z.number().min(0).max(1),
        spread: z.number().min(0).max(1),
        redClipped: z.number().min(0).max(1).optional(),
        greenClipped: z.number().min(0).max(1).optional(),
        blueClipped: z.number().min(0).max(1).optional(),
      }),
    )
    .max(1500),
}) satisfies z.ZodType<RhrRecord>
export async function rhrTicket(data: {
  playerId: string
  surveyId: string
  questionId: string
  position: string
  rested: true
}) {
  return new SignJWT({ ...data, version: RHR_VERSION })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('rhr-start')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret())
}
export async function readRhrTicket(token: string) {
  return (
    await jwtVerify(token, secret(), {
      audience: 'rhr-start',
      algorithms: ['HS256'],
    })
  ).payload
}
export async function signRhrResult(
  data: RhrAnswer,
  scope: { surveyId: string; playerId: string; questionId: string },
) {
  return new SignJWT({ ...data, ...scope })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('rhr-result')
    .setIssuedAt()
    .setExpirationTime('48h')
    .sign(secret())
}
export async function verifyRhrAnswer(
  raw: string,
  scope: { surveyId: string; playerId: string; questionId: string },
): Promise<RhrAnswer | null> {
  try {
    const x = JSON.parse(raw)
    if (typeof x.receipt !== 'string') return null
    const { payload: p } = await jwtVerify(x.receipt, secret(), {
      audience: 'rhr-result',
      algorithms: ['HS256'],
    })
    if (
      p.surveyId !== scope.surveyId ||
      p.playerId !== scope.playerId ||
      p.questionId !== scope.questionId ||
      p.protocolVersion !== RHR_VERSION ||
      p.kind !== 'RHR' ||
      p.quality !== 'ACCEPTED' ||
      typeof p.bpm !== 'number' ||
      p.bpm < 30 ||
      p.bpm > 180 ||
      !RHR_POSITIONS.includes(p.position as (typeof RHR_POSITIONS)[number]) ||
      p.rested !== true ||
      p.durationSeconds !== 15
    )
      return null
    return {
      kind: 'RHR',
      bpm: p.bpm,
      position: p.position as RhrAnswer['position'],
      rested: true,
      durationSeconds: 15,
      protocolVersion: RHR_VERSION,
      ...(typeof p.algorithmVersion === 'string'
        ? { algorithmVersion: p.algorithmVersion }
        : {}),
      measuredAt: String(p.measuredAt),
      quality: 'ACCEPTED',
      torch: p.torch === true,
      fps: Number(p.fps),
      beats: Number(p.beats),
      correlation: Number(p.correlation),
    }
  } catch {
    return null
  }
}
