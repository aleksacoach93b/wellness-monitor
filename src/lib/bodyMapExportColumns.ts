/**
 * Body-map CSV / Power BI column helpers.
 *
 * Default export: intensity (number) + Exact spot (text) + When (text) per zone.
 * Legacy backup (?legacy=1): intensity columns only — same names as before detail fields.
 */

import {
  getBodyMapLocationLabel,
  getBodyMapRating,
  getBodyMapWhenLabels,
  parseBodyMapAnswerValue,
} from '@/lib/bodyMapPainLocation'

/** Exact area IDs used by BodyMap / historical CSV structure. */
export const BODY_MAP_EXPORT_AREA_IDS: string[] = [
  // Front body paths
  'path-4',
  'path-5',
  'path-7',
  'path-8',
  'path-9',
  'path-10',
  'path-11',
  'path-12',
  'path-13',
  'path-14',
  'path-15',
  'path-16',
  'path-17',
  'path-18',
  'path-19',
  'path-20',
  'path-21',
  'path-22',
  'path-23',
  'path-24',
  'path-25',
  'path-26',
  'path-27',
  'path-28',
  'path-29',
  'path-30',
  'path-31',
  'path-32',
  'path-33',
  'path-34',
  'path-35',
  'path-36',
  'path-37',
  'path-38',
  'path-39',
  'path-40',
  'path-41',
  'path-42',
  'path-43',
  'path-44',
  'path-45',
  'path-46',
  'path-47',
  'path-48',
  'path-49',
  'path-50',
  'path-51',
  'path-52',
  'path-53',
  'path-54',
  'path-55',
  'path-56',
  'path-57',
  'path-58',
  'path-59',
  'path-60',
  'path-61',
  'path-62',
  'path-63',
  'path-64',
  'path-65',
  'path-66',
  'path-67',
  'path-68',
  'path-69',
  'path-70',
  'path-71',
  'path-72',
  'path-73',
  'path-74',
  'path-75',
  'path-76',
  'path-77',
  'path-78',
  'path-79',
  'path-80',
  'path-81',
  'path-82',
  'path-83',
  'path-84',
  'path-85',
  'path-86',
  'path-87',
  'path-88',
  'path-89',
  'path-90',
  'path-91',
  'path-92',
  'path-93',
  'path-94',
  // Back body areas
  'left-bflh',
  'right-bflh',
  'left-semimembranosus',
  'right-semimembranosus',
  'left-semitendinosus',
  'right-semitendinosus',
  'left-gluteus-maximus',
  'right-gluteus-maximus',
  'left-gluteus-medius',
  'right-gluteus-medius',
  'left-infraspinatus',
  'right-infraspinatus',
  'left-back-trap',
  'right-back-trap',
  'left-back-upper-trap',
  'right-back-upper-trap',
  'left-latissimus-dorsi',
  'right-latissimus-dorsi',
  'left-teres-major',
  'right-teres-major',
  'left-lower-back',
  'right-lower-back',
  'left-achilles',
  'right-achilles',
  'left-achilles-2',
  'right-achilles-2',
  'left-foot',
  'right-foot',
  'left-heel',
  'right-heel',
  'left-lateral-gastrocs',
  'right-lateral-gastrocs',
  'left-medial-gastrocs',
  'right-medial-gastrocs',
  'left-vastus-lateralis-quad',
  'right-vastus-lateralis-quad',
  'left-triceps',
  'right-triceps',
  'left-elbow',
  'right-elbow',
  'left-back-shoulder',
  'right-back-shoulder',
  'left-back-hip',
  'right-back-hip',
  'left-back-forearm',
  'right-back-forearm',
  'left-back-hand',
  'right-back-hand',
  'left-back-1st-finger',
  'right-back-1st-finger',
  'left-back-2nd-finger',
  'right-back-2nd-finger',
  'left-back-3rd-finger',
  'right-back-3rd-finger',
  'left-back-4th-finger',
  'right-back-4th-finger',
  'left-back-5th-finger',
  'right-back-5th-finger',
  'left-adductor-back',
  'right-adductor-back',
  'back-head',
]

export type BodyMapExportMode = 'full' | 'legacy'

/** Build stable body-map column list for one BODY_MAP question. */
export function buildBodyMapColumnsForQuestion(
  questionText: string,
  getMuscleName: (areaId: string) => string,
  mode: BodyMapExportMode
): string[] {
  const columns: string[] = []
  const seenIntensity = new Set<string>()

  for (const areaId of BODY_MAP_EXPORT_AREA_IDS) {
    const muscleName = getMuscleName(areaId)
    const intensityCol = `${questionText} - ${muscleName}`
    if (seenIntensity.has(intensityCol)) continue
    seenIntensity.add(intensityCol)

    columns.push(intensityCol)
    if (mode === 'full') {
      columns.push(`${intensityCol} - Exact spot`)
      columns.push(`${intensityCol} - When`)
    }
  }

  return columns
}

/** Fill intensity (+ optional Exact spot / When) from a stored body-map answer JSON. */
export function fillBodyMapAnswerColumns(
  row: Record<string, string | number | null>,
  questionText: string,
  rawAnswerValue: string,
  getMuscleName: (areaId: string) => string,
  mode: BodyMapExportMode
): void {
  const trimmed = rawAnswerValue.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return
  }

  const bodyMapData = parseBodyMapAnswerValue(parsed)

  for (const [areaId, value] of Object.entries(bodyMapData)) {
    const muscleName = getMuscleName(areaId)
    const intensityCol = `${questionText} - ${muscleName}`
    const rating = getBodyMapRating(value)
    row[intensityCol] = rating > 0 ? rating : ''

    if (mode === 'full') {
      row[`${intensityCol} - Exact spot`] = getBodyMapLocationLabel(value) || ''
      row[`${intensityCol} - When`] = getBodyMapWhenLabels(value).join('; ')
    }
  }
}
