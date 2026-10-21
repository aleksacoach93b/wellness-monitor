import { parsePvtAnswer } from './options'

// Keep the original six names/order: existing Power BI queries use them.
export const PVT_EXPORT_FIELDS = [
  'Duration s', 'Median RT ms', 'Responses', 'Early taps', 'Quality', 'Attempt ID',
  'Status', 'Protocol', 'Test date', 'Started at UTC', 'Completed at UTC',
  'Response speed 1/s', 'Slow responses count (exploratory)', 'Slow responses percent (exploratory)',
  'Quality flags', 'Position', 'Caffeine 0 or 1', 'Minutes since waking', 'Question ID',
  'Mean RT ms', 'RT SD ms', 'RT CV percent', 'P10 RT ms', 'P90 RT ms', 'Fastest RT ms', 'Slowest RT ms',
  'Measured responses', 'Omissions', 'Unfinished final signals', 'First half responses', 'Second half responses',
  'First half median RT ms', 'Second half median RT ms', 'Second vs first half change percent (exploratory)', 'Analysis version',
] as const
export type PvtExportSession = {
  id: string; responseId: string | null; playerId: string; questionId: string | null;
  durationSeconds: number; protocolVersion: string; status: string; practice: boolean;
  localDate: string; startedAt: Date | string; finishedAt: Date | string | null;
  context: unknown; summary: unknown;
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null
const text = (value: unknown) => typeof value === 'string' ? value : null
const iso = (value: Date | string | null) => value ? new Date(value).toISOString() : null

export function linkedPvtSession(raw: string, sessions: Map<string, PvtExportSession>, responseId: string, playerId: string | null, questionId: string) {
  const answer = parsePvtAnswer(raw)
  const session = answer ? sessions.get(answer.attemptId) : undefined
  return session && session.responseId === responseId && session.playerId === playerId && session.questionId === questionId &&
    !session.practice && session.status === 'COMPLETED' ? session : undefined
}

export function pvtExportValues(raw: string, session?: PvtExportSession): Record<typeof PVT_EXPORT_FIELDS[number], string | number | null> {
  const a = parsePvtAnswer(raw)
  const summary = record(session?.summary)
  const context = record(session?.context)
  const analysis = record(summary.analysis)
  const flags = session ? summary.flags : a?.flags
  return {
    'Duration s': session?.durationSeconds ?? a?.durationSeconds ?? null,
    'Median RT ms': session ? number(summary.medianRT) : a?.medianRT ?? null,
    Responses: session ? number(summary.responses) : a?.responses ?? null,
    'Early taps': session ? number(summary.falseStarts) : a?.falseStarts ?? null,
    Quality: session ? text(summary.quality) : a?.quality ?? null,
    'Attempt ID': a?.attemptId ?? null,
    Status: session?.status ?? null,
    Protocol: session?.protocolVersion ?? null,
    'Test date': session?.localDate ?? null,
    'Started at UTC': session ? iso(session.startedAt) : null,
    'Completed at UTC': session ? iso(session.finishedAt) : null,
    'Response speed 1/s': number(summary.responseSpeed),
    'Slow responses count (exploratory)': number(summary.slowResponses),
    'Slow responses percent (exploratory)': number(summary.slowPercent),
    'Quality flags': Array.isArray(flags) ? flags.filter(x => typeof x === 'string').join('; ') : null,
    Position: text(context.posture),
    'Caffeine 0 or 1': typeof context.caffeine === 'boolean' ? Number(context.caffeine) : null,
    'Minutes since waking': number(context.minutesAwake),
    'Question ID': session?.questionId ?? null,
    'Mean RT ms': number(analysis.meanRT),
    'RT SD ms': number(analysis.sdRT),
    'RT CV percent': number(analysis.cvRT),
    'P10 RT ms': number(analysis.p10RT),
    'P90 RT ms': number(analysis.p90RT),
    'Fastest RT ms': number(analysis.minRT),
    'Slowest RT ms': number(analysis.maxRT),
    'Measured responses': number(analysis.validResponses),
    Omissions: number(analysis.omissions),
    'Unfinished final signals': number(analysis.censored),
    'First half responses': number(analysis.firstHalfResponses),
    'Second half responses': number(analysis.lastHalfResponses),
    'First half median RT ms': number(analysis.firstHalfMedian),
    'Second half median RT ms': number(analysis.lastHalfMedian),
    'Second vs first half change percent (exploratory)': number(analysis.halfDeltaPercent),
    'Analysis version': text(analysis.version),
  }
}
