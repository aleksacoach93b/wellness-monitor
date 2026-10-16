import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'
import {
  RHR_POSITIONS,
  RHR_VERSION,
  RHR_FIXED_VERSION,
  RHR_RESTORED_VERSION,
  RHR_LEGACY_VERSION,
  RHR_MAX_MS,
  RHR_MAX_SAMPLES,
  type RhrRecord,
} from './protocol'
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
  protocolVersion: z
    .enum([
      RHR_VERSION,
      RHR_LEGACY_VERSION,
      RHR_FIXED_VERSION,
      RHR_RESTORED_VERSION,
    ])
    .optional(),
  elapsedMs: z.number().finite().min(0).max(RHR_MAX_MS),
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
    .max(RHR_MAX_SAMPLES),
}) satisfies z.ZodType<RhrRecord>
export async function rhrTicket(data: {
  playerId: string
  surveyId: string
  questionId: string
  position: string
  rested: true
  protocolVersion?:
    | typeof RHR_VERSION
    | typeof RHR_LEGACY_VERSION
    | typeof RHR_FIXED_VERSION
    | typeof RHR_RESTORED_VERSION
}) {
  return new SignJWT({ ...data, version: data.protocolVersion ?? RHR_VERSION })
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
      !(
        [
          RHR_VERSION,
          RHR_LEGACY_VERSION,
          RHR_FIXED_VERSION,
          RHR_RESTORED_VERSION,
        ] as unknown[]
      ).includes(p.protocolVersion) ||
      p.kind !== 'RHR' ||
      p.quality !== 'ACCEPTED' ||
      typeof p.bpm !== 'number' ||
      p.bpm < 30 ||
      p.bpm > 180 ||
      !RHR_POSITIONS.includes(p.position as (typeof RHR_POSITIONS)[number]) ||
      p.rested !== true ||
      (p.protocolVersion !== RHR_VERSION
        ? p.durationSeconds !== 15 ||
          ([RHR_FIXED_VERSION, RHR_RESTORED_VERSION].includes(
            p.protocolVersion as string,
          ) &&
            (p.targetDurationSeconds !== 15 || p.restarts !== 0))
        : typeof p.durationSeconds !== 'number' ||
          !Number.isFinite(p.durationSeconds) ||
          p.durationSeconds < 15 ||
          p.durationSeconds > 60 ||
          p.targetDurationSeconds !== 15 ||
          p.detectionSeconds !== 5 ||
          p.stableWindowSeconds !== 10 ||
          typeof p.restarts !== 'number' ||
          !Number.isInteger(p.restarts) ||
          p.restarts < 0 ||
          p.restarts > 240)
    )
      return null
    return {
      kind: 'RHR',
      bpm: p.bpm,
      position: p.position as RhrAnswer['position'],
      rested: true,
      durationSeconds: Number(p.durationSeconds),
      protocolVersion: String(p.protocolVersion),
      ...(p.protocolVersion === RHR_VERSION
        ? {
            targetDurationSeconds: 15 as const,
            detectionSeconds: 5 as const,
            stableWindowSeconds: 10 as const,
            restarts: Number(p.restarts),
          }
        : {}),
      ...([RHR_FIXED_VERSION, RHR_RESTORED_VERSION].includes(
        p.protocolVersion as string,
      )
        ? { targetDurationSeconds: 15 as const, restarts: 0 }
        : {}),
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
