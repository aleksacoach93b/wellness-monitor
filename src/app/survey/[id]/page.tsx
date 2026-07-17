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
        where: {
          isActive: true,
          ...(survey.teamId ? { teamId: survey.teamId } : {}),
        },
        orderBy: [{ category: 'asc' }, { order: 'asc' }],
        select: { name: true, category: true },
      })
      .catch(() => [])
    sessionTags = tags.filter((t) => t.category === 'SESSION').map((t) => t.name)
    matchDayTags = tags.filter((t) => t.category === 'MATCHDAY').map((t) => t.name)
  }

  let effectiveSurveyTheme = surveyTheme?.trim()
  let clubLogo: string | null = null
  let showClubBranding = true
  // Always scope branding to the survey's team — never fall back to another club's logo
  const ks = survey.teamId
    ? await prisma.kioskSettings
        .findFirst({ where: { teamId: survey.teamId } })
        .catch(() => null)
    : null
  if (!effectiveSurveyTheme) {
    effectiveSurveyTheme = surveyThemeQueryFromKioskTheme(ks?.theme ?? 'dark')
  }
  clubLogo = ks?.clubLogo ?? null
  showClubBranding = ks?.showClubBranding ?? true

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
        clubLogo={clubLogo}
        showClubBranding={showClubBranding}
      />
    </div>
  )
}
