import { prisma } from '@/lib/prisma'
import {
  DEFAULT_OPS_COLUMNS,
  normalizeOpsColumns,
  questionMappingsFromColumns,
  type OpsColumnConfig,
  type OpsSurveyQuestion,
} from '@/lib/opsTableColumns'

type StoredPrefs = {
  /** Legacy flat layout (pre survey-scoped maps). */
  columns?: unknown
  /** Per-survey layouts: enable/order/label/questionId. */
  bySurvey?: Record<string, unknown>
}

function asStoredPrefs(raw: unknown): StoredPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    // Legacy: columns was a bare array
    if (Array.isArray(raw)) return { columns: raw }
    return {}
  }
  const obj = raw as StoredPrefs
  return {
    columns: obj.columns,
    bySurvey:
      obj.bySurvey && typeof obj.bySurvey === 'object' && !Array.isArray(obj.bySurvey)
        ? (obj.bySurvey as Record<string, unknown>)
        : undefined,
  }
}

function columnsForSurvey(raw: unknown, surveyId: string | null | undefined): OpsColumnConfig[] {
  const stored = asStoredPrefs(raw)
  if (surveyId && stored.bySurvey && surveyId in stored.bySurvey) {
    return normalizeOpsColumns(stored.bySurvey[surveyId])
  }
  // Fall back to legacy flat array / default board.
  if (Array.isArray(raw)) return normalizeOpsColumns(raw)
  if (stored.columns) return normalizeOpsColumns(stored.columns)
  return normalizeOpsColumns(DEFAULT_OPS_COLUMNS)
}

function mergeSurveyColumns(
  raw: unknown,
  surveyId: string,
  nextColumns: OpsColumnConfig[],
): StoredPrefs {
  const stored = asStoredPrefs(raw)
  const bySurvey = { ...(stored.bySurvey ?? {}) }
  bySurvey[surveyId] = nextColumns
  return {
    // Keep a copy of last-saved layout for backwards readers.
    columns: nextColumns,
    bySurvey,
  }
}

/**
 * Load column prefs. Never throws — Live Ops must keep working even if the
 * prefs table is missing / mid-migration.
 */
export async function loadOpsTableColumns(args: {
  teamId: string
  adminUserId: string
  surveyId: string | null | undefined
}): Promise<OpsColumnConfig[]> {
  if (!args.surveyId) return normalizeOpsColumns(DEFAULT_OPS_COLUMNS)
  try {
    const row = await prisma.opsTablePreference.findUnique({
      where: {
        teamId_adminUserId: {
          teamId: args.teamId,
          adminUserId: args.adminUserId,
        },
      },
      select: { columns: true },
    })
    return columnsForSurvey(row?.columns, args.surveyId)
  } catch (error) {
    console.error('loadOpsTableColumns failed (using defaults):', error)
    return normalizeOpsColumns(DEFAULT_OPS_COLUMNS)
  }
}

export async function saveOpsTableColumns(args: {
  teamId: string
  adminUserId: string
  surveyId: string
  columns: OpsColumnConfig[]
}): Promise<OpsColumnConfig[]> {
  const normalized = normalizeOpsColumns(args.columns)
  const existing = await prisma.opsTablePreference.findUnique({
    where: {
      teamId_adminUserId: {
        teamId: args.teamId,
        adminUserId: args.adminUserId,
      },
    },
    select: { columns: true },
  })
  const payload = mergeSurveyColumns(existing?.columns, args.surveyId, normalized)
  await prisma.opsTablePreference.upsert({
    where: {
      teamId_adminUserId: {
        teamId: args.teamId,
        adminUserId: args.adminUserId,
      },
    },
    create: {
      teamId: args.teamId,
      adminUserId: args.adminUserId,
      columns: payload,
    },
    update: { columns: payload },
  })
  return normalized
}

export async function loadOpsQuestionMappings(args: {
  teamId: string
  adminUserId: string
  surveyId: string | null | undefined
}) {
  try {
    const columns = await loadOpsTableColumns(args)
    return questionMappingsFromColumns(columns)
  } catch (error) {
    console.error('loadOpsQuestionMappings failed (using empty maps):', error)
    return {}
  }
}

export async function loadSurveyQuestionsForOps(args: {
  teamId: string
  surveyId: string | null | undefined
}): Promise<OpsSurveyQuestion[]> {
  if (!args.surveyId) return []
  try {
    const survey = await prisma.survey.findFirst({
      where: { id: args.surveyId, teamId: args.teamId },
      select: {
        questions: {
          select: { id: true, text: true, type: true, order: true },
          orderBy: { order: 'asc' },
        },
      },
    })
    return (survey?.questions ?? []).map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      order: q.order,
    }))
  } catch (error) {
    console.error('loadSurveyQuestionsForOps failed:', error)
    return []
  }
}
