import type { KioskTheme } from '@/lib/kioskThemes'
import { kioskThemes } from '@/lib/kioskThemes'

export type SurveyAppearanceTheme = 'default' | 'soft' | 'high' | 'dark' | 'green' | 'rose'

export function resolveSurveyAppearanceTheme(raw?: string | null): SurveyAppearanceTheme {
  const v = raw?.trim().toLowerCase()
  if (!v) return 'default'
  if (v === 'soft' || v === 'high' || v === 'dark' || v === 'green' || v === 'rose') return v
  if (v === 'red') return 'rose'
  return 'default'
}

export function getSurveyBackdropClass(theme: SurveyAppearanceTheme): string {
  switch (theme) {
    case 'green':
      return 'min-h-screen bg-emerald-950'
    case 'rose':
      return 'min-h-screen bg-rose-950'
    case 'high':
      return 'min-h-screen bg-zinc-950'
    default:
      return 'min-h-screen bg-slate-950'
  }
}

export function getSurveyShellClasses(theme: SurveyAppearanceTheme) {
  const root: Record<SurveyAppearanceTheme, string> = {
    /** Legacy / direct links — unchanged look */
    default: 'bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800',
    soft: 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950',
    high: 'bg-gradient-to-br from-zinc-950 via-neutral-950 to-zinc-950',
    /** Mirrors kiosk palettes */
    dark: kioskThemes.dark.rootBackground,
    green: kioskThemes.green.rootBackground,
    rose: kioskThemes.red.rootBackground,
  }

  const card: Record<SurveyAppearanceTheme, string> = {
    default:
      'bg-gradient-to-br from-slate-800/80 to-gray-800/80 border-slate-700/50 shadow-xl',
    soft: 'bg-gradient-to-br from-slate-700/88 to-slate-800/92 border-slate-600/45 shadow-xl',
    high:
      'bg-gradient-to-br from-slate-900/95 to-zinc-950/98 border-slate-400/35 ring-1 ring-white/15 shadow-2xl',
    dark:
      `${kioskThemes.dark.modalBackground} rounded-3xl backdrop-blur-sm shadow-xl shadow-black/40`,
    green:
      `${kioskThemes.green.modalBackground} rounded-3xl backdrop-blur-sm shadow-xl shadow-black/35`,
    rose:
      `${kioskThemes.red.modalBackground} rounded-3xl backdrop-blur-sm shadow-xl shadow-black/35`,
  }

  const questionTitle: Record<SurveyAppearanceTheme, string> = {
    default: 'text-sm sm:text-base',
    soft: 'text-sm sm:text-base',
    high: 'text-base sm:text-lg text-white font-semibold',
    dark: 'text-sm sm:text-base',
    green: 'text-sm sm:text-base',
    rose: 'text-sm sm:text-base',
  }

  return { root: root[theme], card: card[theme], questionTitle: questionTitle[theme] }
}

/** Interactive accents + surfaces — keyed to kiosk themes where applicable */
export type SurveyUiTokens = {
  closeButton: string
  headerBackdropBlur: string
  avatarPulse: string
  headerUnderline: string
  /** TEXT / NUMBER / EMAIL base (before shared focus-visible ring tail) */
  inputFieldBase: string
  /** `:focus-visible` keyboard ring (paired with outline-none) */
  focusVisibleRing: string
  hintText: string
  timeAddonButton: string
  /** Boolean Yes/No — unselected state (border-2 added in component) */
  booleanUnselected: string
  primaryCtaButton: string
  /** Scale/RPE/RATING focus-visible ring snippet (inside button classNames) */
  scaleButtonFocusTail: string
  selectedValuePill: string
  selectedValueText: string
  sliderCardBorder: string
  sliderGlowOverlay: string
  sliderGlowBlobTop: string
  selectChoiceRow: string
  selectControl: string
  submitRingOffsetClass: string
  /** Wrapper around SCALE / RATING_SCALE / RPE button grids */
  nestedScaleCard: string
}

export function getSurveyUiTokens(theme: SurveyAppearanceTheme): SurveyUiTokens {
  const blueDefault: SurveyUiTokens = {
    closeButton:
      'text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 focus-visible:ring-cyan-400 focus-visible:ring-offset-slate-900',
    headerBackdropBlur: 'bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-cyan-600/20 blur-3xl',
    avatarPulse: 'bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 animate-pulse',
    headerUnderline: 'bg-gradient-to-r from-blue-400 to-cyan-400',
    inputFieldBase:
      'bg-slate-700/50 border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 focus:bg-slate-600/50',
    focusVisibleRing:
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
    hintText: 'text-blue-300',
    timeAddonButton: 'bg-blue-600 rounded-lg hover:bg-blue-500',
    booleanUnselected:
      'bg-slate-700/50 border-slate-600/50 text-gray-200 hover:border-blue-400/50 hover:bg-slate-600/50',
    primaryCtaButton: 'bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg hover:shadow-xl',
    scaleButtonFocusTail:
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800',
    selectedValuePill: 'bg-blue-900/30 rounded-lg',
    selectedValueText: 'text-blue-300',
    sliderCardBorder:
      'bg-gradient-to-br from-slate-800/90 via-slate-900/85 to-slate-950/90 border border-slate-500/25 ring-1 ring-white/[0.06]',
    sliderGlowOverlay: 'bg-gradient-to-br from-violet-500/[0.07] via-transparent to-cyan-500/[0.06]',
    sliderGlowBlobTop: 'bg-blue-500/10',
    selectChoiceRow:
      'border-slate-600/40 bg-slate-800/30 hover:bg-slate-700/40 focus-within:ring-2 focus-within:ring-cyan-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-900',
    selectControl:
      'accent-cyan-500 border-slate-500 bg-slate-800 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400',
    submitRingOffsetClass: 'focus-visible:ring-offset-slate-900',
    nestedScaleCard: 'bg-gray-600 rounded-xl p-4 border border-gray-500',
  }

  /** Same accents as kiosk `dark`; matches blueDefault — explicit branch for clarity */
  const darkKiosk = blueDefault

  const greenKiosk: SurveyUiTokens = {
    closeButton:
      'text-emerald-300/90 hover:text-white bg-emerald-950/55 hover:bg-emerald-900/70 focus-visible:ring-emerald-400 focus-visible:ring-offset-emerald-950',
    headerBackdropBlur: 'bg-gradient-to-r from-emerald-600/20 via-teal-600/15 to-lime-500/18 blur-3xl',
    avatarPulse: 'bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-lime-500/18 animate-pulse',
    headerUnderline: 'bg-gradient-to-r from-emerald-300 via-teal-300 to-lime-200',
    inputFieldBase:
      'bg-emerald-900/55 border border-emerald-800/45 rounded-lg focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 focus:bg-emerald-900/75',
    focusVisibleRing:
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950',
    hintText: 'text-emerald-200/95',
    timeAddonButton: 'bg-emerald-600 rounded-lg hover:bg-emerald-500',
    booleanUnselected:
      'bg-emerald-950/35 border-emerald-800/38 text-emerald-100/95 hover:border-emerald-400/52 hover:bg-emerald-900/48',
    primaryCtaButton: 'bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-lg hover:shadow-xl',
    scaleButtonFocusTail:
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950',
    selectedValuePill: 'bg-emerald-950/65 rounded-lg border border-emerald-800/35',
    selectedValueText: 'text-emerald-200',
    sliderCardBorder:
      'bg-gradient-to-br from-emerald-950/90 via-emerald-900/88 to-teal-950/92 border border-emerald-800/35 ring-1 ring-emerald-500/15',
    sliderGlowOverlay: 'bg-gradient-to-br from-emerald-500/[0.1] via-transparent to-teal-500/[0.08]',
    sliderGlowBlobTop: 'bg-emerald-500/14',
    selectChoiceRow:
      'border-emerald-800/40 bg-emerald-950/40 hover:bg-emerald-900/50 focus-within:ring-2 focus-within:ring-emerald-400 focus-within:ring-offset-2 focus-within:ring-offset-emerald-950',
    selectControl:
      'accent-emerald-500 border-emerald-700 bg-emerald-950 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400',
    submitRingOffsetClass: 'focus-visible:ring-offset-emerald-950',
    nestedScaleCard: 'bg-emerald-950/55 rounded-xl p-4 border border-emerald-800/45',
  }

  const roseKiosk: SurveyUiTokens = {
    closeButton:
      'text-rose-200/85 hover:text-white bg-rose-950/50 hover:bg-rose-900/65 focus-visible:ring-rose-400 focus-visible:ring-offset-rose-950',
    headerBackdropBlur: 'bg-gradient-to-r from-rose-600/18 via-pink-600/15 to-orange-500/15 blur-3xl',
    avatarPulse: 'bg-gradient-to-r from-rose-500/18 via-pink-500/15 to-orange-500/15 animate-pulse',
    headerUnderline: 'bg-gradient-to-r from-rose-400 via-pink-400 to-orange-300',
    inputFieldBase:
      'bg-rose-950/55 border border-rose-800/45 rounded-lg focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400/50 focus:bg-rose-950/75',
    focusVisibleRing:
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-rose-950',
    hintText: 'text-rose-200',
    timeAddonButton: 'bg-rose-600 rounded-lg hover:bg-rose-500',
    booleanUnselected:
      'bg-rose-950/35 border-rose-800/38 text-rose-100/95 hover:border-rose-400/50 hover:bg-rose-950/55',
    primaryCtaButton: 'bg-rose-600 hover:bg-rose-500 rounded-lg shadow-lg hover:shadow-xl',
    scaleButtonFocusTail:
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-rose-950',
    selectedValuePill: 'bg-rose-950/70 rounded-lg border border-rose-800/40',
    selectedValueText: 'text-rose-100',
    sliderCardBorder:
      'bg-gradient-to-br from-rose-950/92 via-rose-900/88 to-orange-950/90 border border-rose-800/35 ring-1 ring-rose-500/18',
    sliderGlowOverlay: 'bg-gradient-to-br from-rose-500/[0.08] via-transparent to-orange-500/[0.07]',
    sliderGlowBlobTop: 'bg-rose-500/11',
    selectChoiceRow:
      'border-rose-800/40 bg-rose-950/40 hover:bg-rose-900/50 focus-within:ring-2 focus-within:ring-rose-400 focus-within:ring-offset-2 focus-within:ring-offset-rose-950',
    selectControl:
      'accent-rose-500 border-rose-700 bg-rose-950 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400',
    submitRingOffsetClass: 'focus-visible:ring-offset-rose-950',
    nestedScaleCard: 'bg-rose-950/55 rounded-xl p-4 border border-rose-800/45',
  }

  const highContrast: SurveyUiTokens = {
    ...blueDefault,
    focusVisibleRing:
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
    scaleButtonFocusTail:
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
    selectChoiceRow:
      'border-slate-500/50 bg-zinc-900/50 hover:bg-zinc-800/60 focus-within:ring-2 focus-within:ring-cyan-200 focus-within:ring-offset-2 focus-within:ring-offset-zinc-950',
    selectControl:
      'accent-cyan-300 border-slate-500 bg-zinc-900 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200',
    submitRingOffsetClass: 'focus-visible:ring-offset-zinc-950',
    nestedScaleCard: 'bg-zinc-900/90 rounded-xl p-4 border border-slate-500/40',
  }

  switch (theme) {
    case 'dark':
      return darkKiosk
    case 'green':
      return greenKiosk
    case 'rose':
      return roseKiosk
    case 'high':
      return highContrast
    case 'soft':
    default:
      return blueDefault
  }
}

/** Body map fullscreen overlay — must match SurveyForm / kiosk appearance */
export type SurveyBodyMapTokens = {
  overlay: string
  headerBar: string
  headerBorder: string
  closeBtn: string
  continueBtn: string
  viewToggleRail: string
  viewToggleOn: string
  viewToggleOff: string
  hint: string
  selectedCard: string
  selectedTitle: string
  selectedScroll: string
  selectedRow: string
  zoomBtn: string
  emptyHint: string
}

export function getSurveyBodyMapTokens(theme: SurveyAppearanceTheme): SurveyBodyMapTokens {
  const slateBlue: SurveyBodyMapTokens = {
    overlay: 'bg-slate-900',
    headerBar: 'bg-slate-800',
    headerBorder: 'border-slate-600',
    closeBtn: 'text-slate-400 hover:text-slate-200',
    continueBtn: 'bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors',
    viewToggleRail: 'bg-slate-700 rounded-lg p-1 flex',
    viewToggleOn: 'bg-slate-600 text-white',
    viewToggleOff: 'text-slate-300 hover:text-white',
    hint: 'text-slate-300',
    selectedCard: 'bg-slate-800 rounded-xl ring-1 ring-white/[0.06] shadow-lg shadow-black/30',
    selectedTitle: 'text-slate-200',
    selectedScroll: 'scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800',
    selectedRow:
      'bg-slate-700/60 rounded-xl border border-slate-500/25 shadow-md shadow-black/15 backdrop-blur-sm',
    zoomBtn: 'bg-slate-700 hover:bg-slate-600 text-white rounded-full shadow-lg',
    emptyHint: 'text-slate-400',
  }

  const green: SurveyBodyMapTokens = {
    overlay: 'bg-emerald-950',
    headerBar: 'bg-emerald-900',
    headerBorder: 'border-emerald-800/70',
    closeBtn: 'text-emerald-300/90 hover:text-white',
    continueBtn:
      'bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors shadow-emerald-900/40',
    viewToggleRail: 'bg-emerald-950 rounded-lg p-1 flex border border-emerald-800/50',
    viewToggleOn: 'bg-emerald-700 text-white',
    viewToggleOff: 'text-emerald-200/90 hover:text-white',
    hint: 'text-emerald-200/95',
    selectedCard:
      'bg-emerald-900 rounded-xl ring-1 ring-emerald-400/15 border border-emerald-800/50 shadow-xl shadow-black/35',
    selectedTitle: 'text-emerald-100',
    selectedScroll: 'scrollbar-thin scrollbar-thumb-emerald-800 scrollbar-track-emerald-950',
    selectedRow:
      'bg-emerald-950/90 rounded-xl border border-emerald-600/35 shadow-md shadow-emerald-950/60 backdrop-blur-sm',
    zoomBtn:
      'bg-emerald-800 hover:bg-emerald-700 text-white rounded-full shadow-lg border border-emerald-700/50',
    emptyHint: 'text-emerald-400/85',
  }

  const rose: SurveyBodyMapTokens = {
    overlay: 'bg-rose-950',
    headerBar: 'bg-rose-900',
    headerBorder: 'border-rose-800/65',
    closeBtn: 'text-rose-200/85 hover:text-white',
    continueBtn:
      'bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg transition-colors shadow-rose-950/40',
    viewToggleRail: 'bg-rose-950 rounded-lg p-1 flex border border-rose-800/45',
    viewToggleOn: 'bg-rose-700 text-white',
    viewToggleOff: 'text-rose-200/90 hover:text-white',
    hint: 'text-rose-200/90',
    selectedCard: 'bg-rose-900 rounded-xl ring-1 ring-rose-400/12 border border-rose-800/45 shadow-xl shadow-black/35',
    selectedTitle: 'text-rose-100',
    selectedScroll: 'scrollbar-thin scrollbar-thumb-rose-800 scrollbar-track-rose-950',
    selectedRow:
      'bg-rose-950/88 rounded-xl border border-rose-600/35 shadow-md shadow-rose-950/55 backdrop-blur-sm',
    zoomBtn:
      'bg-rose-800 hover:bg-rose-700 text-white rounded-full shadow-lg border border-rose-700/45',
    emptyHint: 'text-rose-400/85',
  }

  const highZinc: SurveyBodyMapTokens = {
    ...slateBlue,
    overlay: 'bg-zinc-950',
    headerBar: 'bg-zinc-900',
    headerBorder: 'border-zinc-600',
    closeBtn: 'text-zinc-400 hover:text-zinc-200',
    continueBtn: 'bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors',
    viewToggleRail: 'bg-zinc-800 rounded-lg p-1 flex',
    viewToggleOn: 'bg-zinc-700 text-white',
    viewToggleOff: 'text-zinc-300 hover:text-white',
    hint: 'text-zinc-300',
    selectedCard: 'bg-zinc-900 rounded-xl ring-1 ring-white/5 shadow-lg shadow-black/30',
    selectedTitle: 'text-zinc-200',
    selectedScroll: 'scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-zinc-950',
    selectedRow:
      'bg-zinc-800/70 rounded-xl border border-zinc-600/30 shadow-md shadow-black/25 backdrop-blur-sm',
    zoomBtn: 'bg-zinc-700 hover:bg-zinc-600 text-white rounded-full shadow-lg',
    emptyHint: 'text-zinc-500',
  }

  switch (theme) {
    case 'green':
      return green
    case 'rose':
      return rose
    case 'high':
      return highZinc
    case 'dark':
      return slateBlue
    default:
      return slateBlue
  }
}

/** Matches draft to survey shape; bumps when questions change */
export function surveyQuestionFingerprint(questionIdsOrdered: string[]) {
  return questionIdsOrdered.join(',')
}

export function surveyDraftStorageKey(surveyId: string, playerId: string | null | undefined) {
  return `wm-survey-draft-v1-${surveyId}-${playerId ?? 'np'}`
}

/** Query param value for survey — `null` means omit (legacy default survey look). */
export function surveyThemeFromKiosk(kioskTheme: KioskTheme): SurveyAppearanceTheme | null {
  if (kioskTheme === 'green') return 'green'
  if (kioskTheme === 'dark') return 'dark'
  if (kioskTheme === 'red') return 'rose'
  if (kioskTheme === 'light') return 'soft'
  if (kioskTheme === 'sky') return 'dark'
  if (kioskTheme === 'graphite') return 'high'
  if (kioskTheme === 'sand') return 'soft'
  if (kioskTheme === 'violet') return 'dark'
  return null
}

/** `surveyTheme` query value from kiosk DB theme — always safe for URLs / SurveyForm. */
export function surveyThemeQueryFromKioskTheme(kioskTheme: KioskTheme | string | null | undefined): string {
  const mapped = surveyThemeFromKiosk(kioskTheme as KioskTheme)
  return mapped ?? 'green'
}
