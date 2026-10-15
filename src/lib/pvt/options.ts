import { PVT_VERSION } from './protocol'
export function pvtDuration(raw?: string | null): 30 | 60 {
  try { return JSON.parse(raw || '{}').durationSeconds === 60 ? 60 : 30 } catch { return 30 }
}
export const pvtOptions = (duration: number) => JSON.stringify({ durationSeconds: duration === 60 ? 60 : 30, protocolVersion: PVT_VERSION })
export type PvtAnswer = { kind: 'PVT'; attemptId: string; token?: string; durationSeconds: number; medianRT?: number | null; responses?: number; falseStarts?: number; quality?: string; flags?: string[] }
export function parsePvtAnswer(value: string): PvtAnswer | null {
  try { const x = JSON.parse(value); return x?.kind === 'PVT' && typeof x.attemptId === 'string' ? x : null } catch { return null }
}
export function pvtAnswerText(value: string) {
  const a = parsePvtAnswer(value)
  return a ? `${a.durationSeconds}s · ${a.medianRT == null ? 'Completed' : `${Math.round(a.medianRT)} ms`} · ${a.responses ?? '—'} responses · ${a.falseStarts ?? '—'} early taps · ${a.quality ?? 'Saved'}` : '—'
}
export function validPvtOptions(raw: unknown): boolean {
  if (typeof raw !== 'string') return false
  try { const x = JSON.parse(raw); return (x.durationSeconds === 30 || x.durationSeconds === 60) && x.protocolVersion === PVT_VERSION } catch { return false }
}
