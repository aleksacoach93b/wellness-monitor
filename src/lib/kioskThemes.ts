export type KioskTheme = 'dark' | 'light' | 'red' | 'green'

interface ThemeClasses {
  rootBackground: string
  overlayOne: string
  overlayTwo: string
  headerBackground: string
  headerOverlay: string
  accentLine: string
  primaryButton: string
  secondaryButton: string
  adminButton: string
  modalBackground: string
  modalOverlay: string
  inputField: string
  panelBackground: string
  panelOverlay: string
  letterActive: string
  letterInactive: string
  letterDisabled: string
  gridOverlay: string
  playerCardIdle: string
  playerCardResponded: string
  emptyStateCard: string
}

const shared = {
  letterDisabled: 'bg-slate-600/30 text-gray-500 cursor-not-allowed border-slate-600/30',
  playerCardResponded:
    'ring-2 ring-green-400/60 bg-gradient-to-br from-green-900/30 to-slate-700/60 border-green-400/30',
}

export const kioskThemes: Record<KioskTheme, ThemeClasses> = {
  dark: {
    rootBackground: 'bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800',
    overlayOne: 'bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-cyan-600/5',
    overlayTwo:
      'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent',
    headerBackground: 'bg-slate-800/60 backdrop-blur-xl border-b border-slate-700/50 shadow-2xl',
    headerOverlay: 'bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-cyan-600/10',
    accentLine: 'bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400',
    primaryButton:
      'bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-500/80 hover:to-purple-500/80 border-blue-500/50',
    secondaryButton:
      'bg-slate-600/80 hover:bg-slate-500/80 border border-slate-600/50',
    adminButton:
      'bg-gradient-to-r from-slate-600/80 to-slate-700/80 hover:from-slate-500/80 hover:to-slate-600/80 border border-slate-600/50',
    modalBackground: 'bg-slate-800/90 border border-slate-700/50',
    modalOverlay: 'bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-cyan-600/10',
    inputField:
      'border border-slate-600/50 bg-slate-700/50 text-white focus:ring-blue-400/50 focus:border-blue-400/50',
    panelBackground: 'bg-slate-800/60 border-b border-slate-700/30',
    panelOverlay: 'bg-gradient-to-r from-blue-600/5 via-purple-600/5 to-cyan-600/5',
    letterActive:
      'bg-gradient-to-r from-blue-500/80 to-cyan-500/80 text-white shadow-xl border-blue-400/50',
    letterInactive:
      'bg-slate-700/50 text-gray-200 hover:bg-slate-600/50 border-slate-600/50 hover:border-blue-400/50',
    letterDisabled: shared.letterDisabled,
    gridOverlay: 'bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-cyan-600/10',
    playerCardIdle:
      'hover:ring-2 hover:ring-blue-400/60 bg-gradient-to-br from-slate-700/60 to-blue-900/20 border-slate-600/30 hover:border-blue-400/30',
    playerCardResponded: shared.playerCardResponded,
    emptyStateCard: 'bg-slate-700/60 border border-slate-600/50',
  },
  light: {
    rootBackground: 'bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700',
    overlayOne: 'bg-gradient-to-br from-slate-500/20 via-slate-400/15 to-slate-500/20',
    overlayTwo:
      'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-300/20 via-transparent to-transparent',
    headerBackground: 'bg-slate-700/60 backdrop-blur-xl border-b border-slate-500/40 shadow-2xl',
    headerOverlay: 'bg-gradient-to-r from-slate-500/20 via-slate-400/20 to-slate-500/20',
    accentLine: 'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200',
    primaryButton:
      'bg-gradient-to-r from-slate-300/80 to-slate-100/80 hover:from-slate-200/80 hover:to-slate-50/80 border-slate-200/50',
    secondaryButton:
      'bg-slate-600/70 hover:bg-slate-500/70 border border-slate-500/40',
    adminButton:
      'bg-gradient-to-r from-slate-500/80 to-slate-600/80 hover:from-slate-400/80 hover:to-slate-500/80 border border-slate-400/50',
    modalBackground: 'bg-slate-700/80 border border-slate-500/50',
    modalOverlay: 'bg-gradient-to-br from-slate-400/20 via-slate-300/20 to-slate-500/20',
    inputField:
      'border border-slate-400/60 bg-slate-600/60 text-white focus:ring-slate-200/70 focus:border-slate-200/70',
    panelBackground: 'bg-slate-700/60 border-b border-slate-500/40',
    panelOverlay: 'bg-gradient-to-r from-slate-500/10 via-slate-400/10 to-slate-500/10',
    letterActive:
      'bg-gradient-to-r from-slate-200/90 to-slate-50/90 text-gray-900 shadow-xl border-slate-100/70',
    letterInactive:
      'bg-slate-600/40 text-white hover:bg-slate-500/40 border-slate-500/30 hover:border-white/50',
    letterDisabled: shared.letterDisabled,
    gridOverlay: 'bg-gradient-to-br from-slate-500/15 via-slate-400/15 to-slate-500/15',
    playerCardIdle:
      'hover:ring-2 hover:ring-slate-200/60 bg-gradient-to-br from-slate-600/60 to-slate-500/40 border-slate-500/40 hover:border-white/40',
    playerCardResponded: shared.playerCardResponded,
    emptyStateCard: 'bg-slate-700/60 border border-slate-500/40',
  },
  red: {
    rootBackground: 'bg-gradient-to-br from-rose-950 via-rose-900 to-rose-950',
    overlayOne: 'bg-gradient-to-br from-rose-700/20 via-rose-600/15 to-orange-600/15',
    overlayTwo:
      'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-500/20 via-transparent to-transparent',
    headerBackground: 'bg-rose-950/60 backdrop-blur-xl border-b border-rose-800/40 shadow-2xl',
    headerOverlay: 'bg-gradient-to-r from-rose-600/10 via-pink-600/10 to-orange-500/10',
    accentLine: 'bg-gradient-to-r from-rose-400 via-pink-400 to-orange-300',
    primaryButton:
      'bg-gradient-to-r from-rose-600/80 to-orange-500/80 hover:from-rose-500/80 hover:to-orange-400/80 border-rose-500/50',
    secondaryButton:
      'bg-rose-800/70 hover:bg-rose-700/70 border border-rose-700/50',
    adminButton:
      'bg-gradient-to-r from-rose-800/80 to-rose-900/80 hover:from-rose-700/80 hover:to-rose-800/80 border border-rose-700/60',
    modalBackground: 'bg-rose-950/90 border border-rose-800/50',
    modalOverlay: 'bg-gradient-to-br from-rose-600/10 via-pink-600/10 to-orange-500/10',
    inputField:
      'border border-rose-700/60 bg-rose-900/60 text-white focus:ring-rose-400/50 focus:border-rose-400/50',
    panelBackground: 'bg-rose-950/60 border-b border-rose-900/40',
    panelOverlay: 'bg-gradient-to-r from-rose-700/5 via-pink-700/5 to-orange-600/5',
    letterActive:
      'bg-gradient-to-r from-rose-500/80 to-orange-500/80 text-white shadow-xl border-rose-400/50',
    letterInactive:
      'bg-rose-900/60 text-gray-200 hover:bg-rose-800/60 border-rose-800/50 hover:border-orange-400/50',
    letterDisabled: shared.letterDisabled,
    gridOverlay: 'bg-gradient-to-br from-rose-600/10 via-pink-600/10 to-orange-500/10',
    playerCardIdle:
      'hover:ring-2 hover:ring-rose-400/60 bg-gradient-to-br from-rose-950/60 to-rose-800/40 border-rose-800/40 hover:border-rose-400/40',
    playerCardResponded: shared.playerCardResponded,
    emptyStateCard: 'bg-rose-950/60 border border-rose-900/50',
  },
  green: {
    rootBackground: 'bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950',
    overlayOne: 'bg-gradient-to-br from-emerald-700/15 via-teal-600/15 to-lime-600/15',
    overlayTwo:
      'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/15 via-transparent to-transparent',
    headerBackground: 'bg-emerald-950/60 backdrop-blur-xl border-b border-emerald-900/40 shadow-2xl',
    headerOverlay: 'bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-lime-500/10',
    accentLine: 'bg-gradient-to-r from-emerald-300 via-teal-300 to-lime-200',
    primaryButton:
      'bg-gradient-to-r from-emerald-500/80 to-teal-500/80 hover:from-emerald-400/80 hover:to-teal-400/80 border-emerald-400/50',
    secondaryButton:
      'bg-emerald-900/70 hover:bg-emerald-800/70 border border-emerald-800/60',
    adminButton:
      'bg-gradient-to-r from-emerald-900/80 to-teal-900/80 hover:from-emerald-800/80 hover:to-teal-800/80 border border-emerald-800/60',
    modalBackground: 'bg-emerald-950/90 border border-emerald-900/60',
    modalOverlay: 'bg-gradient-to-br from-emerald-600/10 via-teal-600/10 to-lime-500/10',
    inputField:
      'border border-emerald-800/50 bg-emerald-900/60 text-white focus:ring-emerald-400/50 focus:border-emerald-400/50',
    panelBackground: 'bg-emerald-950/60 border-b border-emerald-900/40',
    panelOverlay: 'bg-gradient-to-r from-emerald-700/5 via-teal-700/5 to-lime-600/5',
    letterActive:
      'bg-gradient-to-r from-emerald-500/80 to-teal-500/80 text-white shadow-xl border-emerald-400/50',
    letterInactive:
      'bg-emerald-900/60 text-gray-200 hover:bg-emerald-800/60 border-emerald-800/50 hover:border-teal-400/50',
    letterDisabled: shared.letterDisabled,
    gridOverlay: 'bg-gradient-to-br from-emerald-600/10 via-teal-600/10 to-lime-500/10',
    playerCardIdle:
      'hover:ring-2 hover:ring-emerald-400/60 bg-gradient-to-br from-emerald-950/60 to-teal-900/30 border-emerald-900/40 hover:border-emerald-400/40',
    playerCardResponded: shared.playerCardResponded,
    emptyStateCard: 'bg-emerald-950/60 border border-emerald-900/50',
  },
}

