import { parsePvtAnswer } from './options'
export const PVT_EXPORT_FIELDS = ['Duration s', 'Median RT ms', 'Responses', 'Early taps', 'Quality', 'Attempt ID'] as const
export function pvtExportValues(raw: string): Record<typeof PVT_EXPORT_FIELDS[number], string | number | null> {
  const a = parsePvtAnswer(raw)
  return { 'Duration s': a?.durationSeconds ?? null, 'Median RT ms': a?.medianRT ?? null, Responses: a?.responses ?? null, 'Early taps': a?.falseStarts ?? null, Quality: a?.quality ?? null, 'Attempt ID': a?.attemptId ?? null }
}
