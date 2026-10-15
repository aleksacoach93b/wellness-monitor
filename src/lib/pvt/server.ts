import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { PVT_DURATIONS, type PvtResult } from './protocol'

// Two gates: server feature flag AND a coach's per-survey opt-in.
export const pvtEnabled = () => process.env.PVT_ENABLED !== 'false'
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex')
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    const source = new URL(origin)
    const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || new URL(request.url).protocol.replace(':', '')
    // Next's internal URL can use localhost behind a proxy. Compare the actual
    // request host, retaining the port, rather than the internal nextUrl origin.
    return source.host === request.headers.get('host') && source.protocol === `${protocol}:`
  } catch { return false }
}
export function equalSecret(actual: string, expected: string) {
  return timingSafeEqual(Buffer.from(hashToken(actual)), Buffer.from(hashToken(expected)))
}
export function localDay(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
export function surveyOpen(survey: {
  isActive: boolean; isRecurring: boolean; timezone: string;
  startDate: Date | null; endDate: Date | null; dailyStartTime: string | null; dailyEndTime: string | null;
}, now = new Date()) {
  if (!survey.isRecurring) return survey.isActive
  const day = localDay(now, survey.timezone)
  if (survey.startDate && day < localDay(survey.startDate, survey.timezone)) return false
  if (survey.endDate && day > localDay(survey.endDate, survey.timezone)) return false
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: survey.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now)
  const start = survey.dailyStartTime
  const end = survey.dailyEndTime
  if (!start || !end) return survey.isActive
  return start <= end ? time >= start && time <= end : time >= start || time <= end
}
export const durationSchema = z.union([z.literal(30), z.literal(60)])
export const contextSchema = z.object({
  posture: z.enum(['seated', 'reclined', 'lying']),
  caffeine: z.boolean(),
  minutesAwake: z.number().int().min(0).max(1440),
  deviceId: z.string().uuid(),
})
const finite = z.number().finite().nonnegative()
export const resultSchema = z.object({
  trials: z.array(z.object({
    kind: z.enum(['response', 'false-start', 'timeout', 'censored']),
    onsetMs: finite.nullable(), atMs: finite, rtMs: finite.nullable(), waitMs: finite.nullable(),
  })).max(2000),
  elapsedMs: finite,
  maxFrameGapMs: finite,
  interruption: z.enum(['hidden', 'blur', 'orientation', 'cancelled', 'too-many-inputs']).nullable(),
}) satisfies z.ZodType<PvtResult>
export { PVT_DURATIONS }
