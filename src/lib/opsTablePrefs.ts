import { prisma } from '@/lib/prisma'
import {
  DEFAULT_OPS_COLUMNS,
  normalizeOpsColumns,
  questionMappingsFromColumns,
  type OpsColumnConfig,
  type OpsSurveyQuestion,
} from '@/lib/opsTableColumns'

export async function loadOpsTableColumns(args: {
  teamId: string
  adminUserId: string
  surveyId: string | null | undefined
}): Promise<OpsColumnConfig[]> {
  if (!args.surveyId) return normalizeOpsColumns(DEFAULT_OPS_COLUMNS)
  const row = await prisma.opsTablePreference.findUnique({
    where: {
      teamId_adminUserId_surveyId: {
        teamId: args.teamId,
        adminUserId: args.adminUserId,
        surveyId: args.surveyId,
      },
    },
    select: { columns: true },
  })
  return normalizeOpsColumns(row?.columns ?? DEFAULT_OPS_COLUMNS)
}

export async function loadOpsQuestionMappings(args: {
  teamId: string
  adminUserId: string
  surveyId: string | null | undefined
}) {
  const columns = await loadOpsTableColumns(args)
  return questionMappingsFromColumns(columns)
}

export async function loadSurveyQuestionsForOps(args: {
  teamId: string
  surveyId: string | null | undefined
}): Promise<OpsSurveyQuestion[]> {
  if (!args.surveyId) return []
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
}
