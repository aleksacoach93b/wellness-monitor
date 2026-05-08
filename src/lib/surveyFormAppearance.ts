import type { KioskTheme } from '@/lib/kioskThemes'

export type SurveyAppearanceTheme = 'default' | 'soft' | 'high'

export function resolveSurveyAppearanceTheme(raw?: string | null): SurveyAppearanceTheme {
  if (raw === 'soft' || raw === 'high') return raw
  return 'default'
}

export function getSurveyShellClasses(t: SurveyAppearanceTheme) {
  const root: Record<SurveyAppearanceTheme, string> = {
    default: 'bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800',
    soft: 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950',
    high: 'bg-gradient-to-br from-zinc-950 via-neutral-950 to-zinc-950',
  }
  const card: Record<SurveyAppearanceTheme, string> = {
    default:
      'bg-gradient-to-br from-slate-800/80 to-gray-800/80 border-slate-700/50 shadow-xl',
    soft: 'bg-gradient-to-br from-slate-700/88 to-slate-800/92 border-slate-600/45 shadow-xl',
    high:
      'bg-gradient-to-br from-slate-900/95 to-zinc-950/98 border-slate-400/35 ring-1 ring-white/15 shadow-2xl',
  }
  const questionTitle: Record<SurveyAppearanceTheme, string> = {
    default: 'text-sm sm:text-base',
    soft: 'text-sm sm:text-base',
    high: 'text-base sm:text-lg text-white font-semibold',
  }
  return { root: root[t], card: card[t], questionTitle: questionTitle[t] }
}

/** Matches draft to survey shape; bumps when questions change */
export function surveyQuestionFingerprint(questionIdsOrdered: string[]) {
  return questionIdsOrdered.join(',')
}

export function surveyDraftStorageKey(surveyId: string, playerId: string | null | undefined) {
  return `wm-survey-draft-v1-${surveyId}-${playerId ?? 'np'}`
}

/** Align survey takeover UI with kiosk color mode (optional query param). */
export function surveyThemeFromKiosk(kioskTheme: KioskTheme): SurveyAppearanceTheme | null {
  if (kioskTheme === 'light' || kioskTheme === 'green') return 'soft'
  if (kioskTheme === 'red') return 'high'
  return null
}

export const surveyFieldFocusClasses =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900'
