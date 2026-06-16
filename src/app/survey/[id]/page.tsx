import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SurveyForm from './SurveyForm'
import {
  getSurveyBackdropClass,
  resolveSurveyAppearanceTheme,
  surveyThemeQueryFromKioskTheme,
} from '@/lib/surveyFormAppearance'

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic'

interface SurveyPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    playerId?: string
    surveyTheme?: string
  }>
}

export default async function SurveyPage({ params, searchParams }: SurveyPageProps) {
  const { id } = await params
  const { playerId, surveyTheme } = await searchParams

  let survey = null

  try {
    survey = await prisma.survey.findUnique({
      where: {
        id: id,
      },
      include: {
        questions: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })
  } catch (error) {
    console.error('Error fetching survey:', error)
    notFound()
  }

  if (!survey) {
    notFound()
  }

  let player = null
  if (playerId) {
    player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },
    })
  }

  let sessionTags: string[] = []
  let matchDayTags: string[] = []
  if (survey.trackSessionType || survey.trackMatchDay) {
    const tags = await prisma.tag
      .findMany({
        where: { isActive: true },
        orderBy: [{ category: 'asc' }, { order: 'asc' }],
        select: { name: true, category: true },
      })
      .catch(() => [])
    sessionTags = tags.filter((t) => t.category === 'SESSION').map((t) => t.name)
    matchDayTags = tags.filter((t) => t.category === 'MATCHDAY').map((t) => t.name)
  }

  let effectiveSurveyTheme = surveyTheme?.trim()
  if (!effectiveSurveyTheme) {
    const ks = await prisma.kioskSettings.findFirst().catch(() => null)
    effectiveSurveyTheme = surveyThemeQueryFromKioskTheme(ks?.theme ?? 'dark')
  }

  const appearanceResolved = resolveSurveyAppearanceTheme(effectiveSurveyTheme)

  return (
    <div className={getSurveyBackdropClass(appearanceResolved)}>
      <SurveyForm
        survey={survey}
        player={player}
        surveyTheme={effectiveSurveyTheme}
        draftPlayerId={playerId ?? null}
        sessionTags={sessionTags}
        matchDayTags={matchDayTags}
      />
    </div>
  )
}
