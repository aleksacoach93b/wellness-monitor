import { median } from './protocol'
export type PvtSummary = { medianRT: number | null; responseSpeed: number | null; responses: number; slowResponses: number; slowPercent: number | null; falseStarts: number; quality: string; flags: string[] }
export type PvtSessionRow = {
  id: string; responseId?: string | null; questionId?: string | null; playerId: string; surveyId: string; localDate: string; startedAt: string;
  finishedAt: string | null; durationSeconds: number; protocolVersion: string; practice: boolean;
  status: string; deviceId: string; userAgent: string;
  context: { posture?: string; caffeine?: boolean; minutesAwake?: number };
  summary: PvtSummary | null;
  player: { firstName: string; lastName: string };
}
export function baselineFor(current: PvtSessionRow, sessions: PvtSessionRow[]) {
  const earliest = new Date(current.localDate + 'T00:00:00Z')
  earliest.setUTCDate(earliest.getUTCDate() - 28)
  const firstDay = earliest.toISOString().slice(0, 10)
  const days = new Map<string, number>()
  const eligible = sessions.filter(s => s.playerId === current.playerId && s.surveyId === current.surveyId &&
    s.questionId === current.questionId && s.durationSeconds === current.durationSeconds && s.protocolVersion === current.protocolVersion &&
    s.deviceId === current.deviceId && s.userAgent === current.userAgent && s.context.posture === current.context.posture &&
    s.context.caffeine === current.context.caffeine && s.localDate >= firstDay && s.localDate < current.localDate &&
    !s.practice && s.status === 'COMPLETED' && s.summary?.quality === 'OK' && s.summary.medianRT !== null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  for (const s of eligible) if (!days.has(s.localDate)) days.set(s.localDate, s.summary!.medianRT!)
  const values = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([, v]) => v)
  const reference = values.length >= 7 ? median(values) : null
  const deltaPercent = reference && current.summary?.quality === 'OK' && !current.practice && current.status === 'COMPLETED' && current.summary.medianRT !== null
    ? (current.summary.medianRT / reference - 1) * 100 : null
  return { days: values.length, reference, deltaPercent }
}
