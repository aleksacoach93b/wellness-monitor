export type KioskTheme =
  | 'dark'
  | 'light'
  | 'red'
  | 'green'
  | 'sky'
  | 'graphite'
  | 'sand'
  | 'violet'

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
  /** Bottom status chip when player has not completed survey — parallels “Done” pill shape */
  playerStatusIdlePill: string
  /** Keyboard focus ring on player cards (ring-offset matches page tone) */
  playerCardFocus: string
  /** Placeholder avatar (no photo): initial letter circle */
  playerAvatarInitial: string
  emptyStateCard: string
  /** Opaque background used behind sticky roster header / first column */
  rosterStickyBg: string
  /** Soft, reduced-intensity gradient for the sticky name column that fades into the row */
  rosterStickyFade: string
}

const shared = {
  letterDisabled: 'bg-slate-600/30 text-gray-500 cursor-not-allowed border-slate-600/30',
  playerCardResponded:
    'border border-emerald-300/35 ring-2 ring-green-400/55 bg-gradient-to-br from-green-900/38 to-slate-800/60 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.06),0_0_26px_-4px_rgba(34,197,94,0.32)]',
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
      'border border-white/14 bg-gradient-to-br from-slate-700/60 to-blue-900/25 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.06),0_14px_44px_-14px_rgba(56,189,248,0.16)] hover:border-sky-300/38 hover:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.09),0_18px_50px_-12px_rgba(56,189,248,0.22)] hover:shadow-2xl',
    playerCardResponded: shared.playerCardResponded,
    playerStatusIdlePill:
      'inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-blue-400/35 bg-slate-900/55 px-2.5 py-1 text-[11px] font-semibold text-blue-200 shadow-md backdrop-blur-sm sm:min-h-0 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs',
    playerCardFocus:
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
    playerAvatarInitial:
      'bg-gradient-to-br from-blue-600/50 to-slate-800/75 text-white shadow-2xl border-slate-500/55 group-hover:border-blue-400/65',
    emptyStateCard: 'bg-slate-700/60 border border-slate-600/50',
    rosterStickyBg: 'bg-slate-900/95',
    rosterStickyFade:
      'bg-gradient-to-r from-slate-900/55 from-55% via-slate-900/30 via-80% to-transparent shadow-[10px_0_22px_-14px_rgba(56,189,248,0.45)]',
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
      'border border-white/18 bg-gradient-to-br from-slate-600/60 to-slate-500/42 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),0_14px_44px_-14px_rgba(255,255,255,0.07)] hover:border-white/38 hover:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.11),0_18px_50px_-14px_rgba(255,255,255,0.1)] hover:shadow-2xl',
    playerCardResponded: shared.playerCardResponded,
    playerStatusIdlePill:
      'inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-slate-300/45 bg-slate-800/65 px-2.5 py-1 text-[11px] font-semibold text-slate-100 shadow-md backdrop-blur-sm sm:min-h-0 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs',
    playerCardFocus:
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-100 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800',
    playerAvatarInitial:
      'bg-gradient-to-br from-slate-500/55 to-slate-700/80 text-white shadow-2xl border-slate-400/45 group-hover:border-white/45',
    emptyStateCard: 'bg-slate-700/60 border border-slate-500/40',
    rosterStickyBg: 'bg-slate-700/95',
    rosterStickyFade:
      'bg-gradient-to-r from-slate-700/55 from-55% via-slate-700/30 via-80% to-transparent shadow-[10px_0_22px_-14px_rgba(255,255,255,0.35)]',
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
      'border border-orange-300/35 bg-gradient-to-br from-rose-950/60 to-rose-900/38 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.06),0_14px_44px_-14px_rgba(251,146,60,0.14)] hover:border-orange-300/52 hover:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.09),0_18px_50px_-12px_rgba(251,113,133,0.18)] hover:shadow-2xl',
    playerCardResponded: shared.playerCardResponded,
    playerStatusIdlePill:
      'inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-orange-400/40 bg-rose-950/55 px-2.5 py-1 text-[11px] font-semibold text-rose-100 shadow-md backdrop-blur-sm sm:min-h-0 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs',
    playerCardFocus:
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-rose-950',
    playerAvatarInitial:
      'bg-gradient-to-br from-rose-700/55 to-rose-950/85 text-rose-50 shadow-2xl border-rose-600/45 group-hover:border-orange-400/55',
    emptyStateCard: 'bg-rose-950/60 border border-rose-900/50',
    rosterStickyBg: 'bg-rose-950/95',
    rosterStickyFade:
      'bg-gradient-to-r from-rose-950/55 from-55% via-rose-950/30 via-80% to-transparent shadow-[10px_0_22px_-14px_rgba(251,146,60,0.4)]',
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
      'border border-white/15 bg-gradient-to-br from-emerald-950/65 to-teal-950/34 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.07),0_0_0_1px_rgba(251,146,60,0.14),0_14px_44px_-14px_rgba(45,212,191,0.15)] hover:border-teal-200/42 hover:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.09),0_0_0_1px_rgba(45,212,191,0.22),0_18px_50px_-12px_rgba(16,185,129,0.18)] hover:shadow-2xl',
    playerCardResponded: shared.playerCardResponded,
    playerStatusIdlePill:
      'inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-950/55 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 shadow-md backdrop-blur-sm sm:min-h-0 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs',
    playerCardFocus:
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950',
    playerAvatarInitial:
      'bg-gradient-to-br from-emerald-600/50 to-emerald-950/85 text-emerald-50 shadow-2xl border-emerald-500/45 group-hover:border-teal-300/55',
    emptyStateCard: 'bg-emerald-950/60 border border-emerald-900/50',
    rosterStickyBg: 'bg-emerald-950/95',
    rosterStickyFade:
      'bg-gradient-to-r from-emerald-950/55 from-55% via-emerald-950/30 via-80% to-transparent shadow-[10px_0_22px_-14px_rgba(45,212,191,0.4)]',
  },
  sky: {
    rootBackground: 'bg-gradient-to-br from-sky-900 via-blue-950 to-slate-900',
    overlayOne: 'bg-gradient-to-br from-sky-500/10 via-cyan-500/10 to-blue-500/10',
    overlayTwo:
      'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-400/12 via-transparent to-transparent',
    headerBackground: 'bg-sky-950/60 backdrop-blur-xl border-b border-sky-800/50 shadow-2xl',
    headerOverlay: 'bg-gradient-to-r from-sky-500/10 via-cyan-500/10 to-blue-500/10',
    accentLine: 'bg-gradient-to-r from-sky-300 via-cyan-300 to-blue-300',
    primaryButton:
      'bg-gradient-to-r from-sky-500/80 to-cyan-500/80 hover:from-sky-400/80 hover:to-cyan-400/80 border-sky-400/50',
    secondaryButton: 'bg-sky-800/70 hover:bg-sky-700/70 border border-sky-700/50',
    adminButton:
      'bg-gradient-to-r from-sky-800/80 to-blue-900/80 hover:from-sky-700/80 hover:to-blue-800/80 border border-sky-700/60',
    modalBackground: 'bg-sky-950/90 border border-sky-800/50',
    modalOverlay: 'bg-gradient-to-br from-sky-500/10 via-cyan-500/10 to-blue-500/10',
    inputField:
      'border border-sky-700/50 bg-sky-900/50 text-white focus:ring-sky-400/50 focus:border-sky-400/50',
    panelBackground: 'bg-sky-950/60 border-b border-sky-800/30',
    panelOverlay: 'bg-gradient-to-r from-sky-500/5 via-cyan-500/5 to-blue-500/5',
    letterActive:
      'bg-gradient-to-r from-sky-400/80 to-cyan-400/80 text-white shadow-xl border-sky-300/50',
    letterInactive:
      'bg-sky-900/50 text-gray-100 hover:bg-sky-800/50 border-sky-700/50 hover:border-cyan-300/50',
    letterDisabled: shared.letterDisabled,
    gridOverlay: 'bg-gradient-to-br from-sky-500/10 via-cyan-500/10 to-blue-500/10',
    playerCardIdle:
      'border border-white/14 bg-gradient-to-br from-sky-800/55 to-blue-950/30 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.06),0_14px_44px_-14px_rgba(56,189,248,0.18)] hover:border-cyan-300/40 hover:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.09),0_18px_50px_-12px_rgba(56,189,248,0.24)] hover:shadow-2xl',
    playerCardResponded: shared.playerCardResponded,
    playerStatusIdlePill:
      'inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-cyan-400/35 bg-sky-950/55 px-2.5 py-1 text-[11px] font-semibold text-cyan-100 shadow-md backdrop-blur-sm sm:min-h-0 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs',
    playerCardFocus:
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-sky-950',
    playerAvatarInitial:
      'bg-gradient-to-br from-sky-600/50 to-blue-950/85 text-white shadow-2xl border-sky-500/50 group-hover:border-cyan-300/60',
    emptyStateCard: 'bg-sky-950/60 border border-sky-800/50',
    rosterStickyBg: 'bg-sky-950/95',
    rosterStickyFade:
      'bg-gradient-to-r from-sky-950/55 from-55% via-sky-950/30 via-80% to-transparent shadow-[10px_0_22px_-14px_rgba(56,189,248,0.45)]',
  },
  graphite: {
    rootBackground: 'bg-gradient-to-br from-zinc-900 via-neutral-900 to-zinc-950',
    overlayOne: 'bg-gradient-to-br from-zinc-500/8 via-neutral-500/8 to-zinc-400/8',
    overlayTwo:
      'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-400/10 via-transparent to-transparent',
    headerBackground: 'bg-zinc-900/60 backdrop-blur-xl border-b border-zinc-700/50 shadow-2xl',
    headerOverlay: 'bg-gradient-to-r from-zinc-500/10 via-neutral-500/10 to-zinc-400/10',
    accentLine: 'bg-gradient-to-r from-zinc-300 via-neutral-200 to-zinc-300',
    primaryButton:
      'bg-gradient-to-r from-zinc-600/80 to-neutral-600/80 hover:from-zinc-500/80 hover:to-neutral-500/80 border-zinc-500/50',
    secondaryButton: 'bg-zinc-700/70 hover:bg-zinc-600/70 border border-zinc-600/50',
    adminButton:
      'bg-gradient-to-r from-zinc-700/80 to-neutral-800/80 hover:from-zinc-600/80 hover:to-neutral-700/80 border border-zinc-600/60',
    modalBackground: 'bg-zinc-900/90 border border-zinc-700/50',
    modalOverlay: 'bg-gradient-to-br from-zinc-500/10 via-neutral-500/10 to-zinc-400/10',
    inputField:
      'border border-zinc-600/50 bg-zinc-800/50 text-white focus:ring-zinc-400/50 focus:border-zinc-400/50',
    panelBackground: 'bg-zinc-900/60 border-b border-zinc-700/30',
    panelOverlay: 'bg-gradient-to-r from-zinc-500/5 via-neutral-500/5 to-zinc-400/5',
    letterActive:
      'bg-gradient-to-r from-zinc-300/85 to-neutral-200/85 text-zinc-900 shadow-xl border-zinc-200/60',
    letterInactive:
      'bg-zinc-800/50 text-gray-100 hover:bg-zinc-700/50 border-zinc-600/50 hover:border-zinc-300/50',
    letterDisabled: shared.letterDisabled,
    gridOverlay: 'bg-gradient-to-br from-zinc-500/10 via-neutral-500/10 to-zinc-400/10',
    playerCardIdle:
      'border border-white/12 bg-gradient-to-br from-zinc-800/60 to-neutral-900/40 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.05),0_14px_44px_-14px_rgba(212,212,216,0.1)] hover:border-zinc-300/35 hover:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),0_18px_50px_-12px_rgba(212,212,216,0.14)] hover:shadow-2xl',
    playerCardResponded: shared.playerCardResponded,
    playerStatusIdlePill:
      'inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-zinc-400/35 bg-zinc-900/55 px-2.5 py-1 text-[11px] font-semibold text-zinc-100 shadow-md backdrop-blur-sm sm:min-h-0 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs',
    playerCardFocus:
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
    playerAvatarInitial:
      'bg-gradient-to-br from-zinc-600/55 to-neutral-900/85 text-white shadow-2xl border-zinc-500/50 group-hover:border-zinc-300/60',
    emptyStateCard: 'bg-zinc-900/60 border border-zinc-700/50',
    rosterStickyBg: 'bg-zinc-950/95',
    rosterStickyFade:
      'bg-gradient-to-r from-zinc-950/55 from-55% via-zinc-950/30 via-80% to-transparent shadow-[10px_0_22px_-14px_rgba(212,212,216,0.32)]',
  },
  sand: {
    rootBackground: 'bg-gradient-to-br from-sky-50 via-white to-blue-50',
    overlayOne: 'bg-gradient-to-br from-sky-200/30 via-blue-200/20 to-indigo-200/25',
    overlayTwo:
      'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-200/40 via-transparent to-transparent',
    headerBackground: 'bg-white/75 backdrop-blur-xl border-b border-sky-200/70 shadow-lg shadow-sky-900/5',
    headerOverlay: 'bg-gradient-to-r from-sky-200/25 via-blue-200/20 to-indigo-200/25',
    accentLine: 'bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400',
    primaryButton:
      'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 border-sky-400/50',
    secondaryButton: 'bg-slate-600 hover:bg-slate-500 border border-slate-500/40',
    adminButton:
      'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 border border-slate-500/40',
    modalBackground: 'bg-white/95 border border-sky-200/70',
    modalOverlay: 'bg-gradient-to-br from-sky-200/20 via-blue-200/15 to-indigo-200/20',
    inputField:
      'border border-sky-300/70 bg-white text-slate-900 placeholder-slate-400 focus:ring-sky-400/50 focus:border-sky-400/60',
    panelBackground: 'bg-white/70 border-b border-sky-200/60',
    panelOverlay: 'bg-gradient-to-r from-sky-200/15 via-blue-200/10 to-indigo-200/15',
    letterActive:
      'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25 border-sky-400/50',
    letterInactive:
      'bg-white text-slate-700 hover:bg-sky-50 border-sky-200/80 hover:border-sky-400/60',
    letterDisabled: 'bg-slate-200/70 text-slate-400 cursor-not-allowed border-slate-200',
    gridOverlay: 'bg-gradient-to-br from-sky-200/20 via-blue-200/15 to-indigo-200/20',
    playerCardIdle:
      'border border-sky-200/80 bg-white [box-shadow:0_1px_2px_0_rgba(15,23,42,0.06)] hover:border-sky-400/60 hover:[box-shadow:0_10px_30px_-12px_rgba(56,189,248,0.4)] hover:shadow-md',
    playerCardResponded:
      'border border-emerald-300 ring-2 ring-emerald-300/55 bg-emerald-50 [box-shadow:0_1px_2px_0_rgba(15,23,42,0.05),0_0_20px_-6px_rgba(16,185,129,0.3)]',
    playerStatusIdlePill:
      'inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-sky-300/70 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 shadow-sm sm:min-h-0 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs',
    playerCardFocus:
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
    playerAvatarInitial:
      'bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-md border-sky-300/70 group-hover:border-sky-400',
    emptyStateCard: 'bg-white border border-sky-200/80',
    rosterStickyBg: 'bg-white/95',
    rosterStickyFade:
      'bg-gradient-to-r from-white/80 from-55% via-white/45 via-80% to-transparent shadow-[10px_0_22px_-14px_rgba(56,189,248,0.4)]',
  },
  violet: {
    rootBackground: 'bg-gradient-to-br from-violet-950 via-purple-950 to-fuchsia-950',
    overlayOne: 'bg-gradient-to-br from-violet-600/15 via-purple-600/15 to-fuchsia-600/15',
    overlayTwo:
      'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-fuchsia-500/18 via-transparent to-transparent',
    headerBackground: 'bg-violet-950/60 backdrop-blur-xl border-b border-violet-800/40 shadow-2xl',
    headerOverlay: 'bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-fuchsia-600/10',
    accentLine: 'bg-gradient-to-r from-violet-300 via-purple-300 to-fuchsia-300',
    primaryButton:
      'bg-gradient-to-r from-violet-600/80 to-fuchsia-600/80 hover:from-violet-500/80 hover:to-fuchsia-500/80 border-violet-500/50',
    secondaryButton: 'bg-violet-900/70 hover:bg-violet-800/70 border border-violet-800/50',
    adminButton:
      'bg-gradient-to-r from-violet-900/80 to-purple-950/80 hover:from-violet-800/80 hover:to-purple-900/80 border border-violet-800/60',
    modalBackground: 'bg-violet-950/90 border border-violet-800/50',
    modalOverlay: 'bg-gradient-to-br from-violet-600/10 via-purple-600/10 to-fuchsia-600/10',
    inputField:
      'border border-violet-700/60 bg-violet-900/55 text-white focus:ring-fuchsia-400/50 focus:border-fuchsia-400/50',
    panelBackground: 'bg-violet-950/60 border-b border-violet-900/40',
    panelOverlay: 'bg-gradient-to-r from-violet-700/5 via-purple-700/5 to-fuchsia-600/5',
    letterActive:
      'bg-gradient-to-r from-violet-500/80 to-fuchsia-500/80 text-white shadow-xl border-violet-400/50',
    letterInactive:
      'bg-violet-900/55 text-gray-100 hover:bg-violet-800/55 border-violet-800/50 hover:border-fuchsia-400/50',
    letterDisabled: shared.letterDisabled,
    gridOverlay: 'bg-gradient-to-br from-violet-600/10 via-purple-600/10 to-fuchsia-600/10',
    playerCardIdle:
      'border border-white/14 bg-gradient-to-br from-violet-900/55 to-purple-950/35 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.06),0_14px_44px_-14px_rgba(192,132,252,0.18)] hover:border-fuchsia-300/40 hover:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.09),0_18px_50px_-12px_rgba(217,70,239,0.22)] hover:shadow-2xl',
    playerCardResponded: shared.playerCardResponded,
    playerStatusIdlePill:
      'inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-fuchsia-400/35 bg-violet-950/55 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-100 shadow-md backdrop-blur-sm sm:min-h-0 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs',
    playerCardFocus:
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-950',
    playerAvatarInitial:
      'bg-gradient-to-br from-violet-600/50 to-purple-950/85 text-white shadow-2xl border-violet-500/50 group-hover:border-fuchsia-300/60',
    emptyStateCard: 'bg-violet-950/60 border border-violet-800/50',
    rosterStickyBg: 'bg-violet-950/95',
    rosterStickyFade:
      'bg-gradient-to-r from-violet-950/55 from-55% via-violet-950/30 via-80% to-transparent shadow-[10px_0_22px_-14px_rgba(217,70,239,0.4)]',
  },
}

/** Themes that use a light background and therefore need dark text. */
export const LIGHT_KIOSK_THEMES: KioskTheme[] = ['sand']

export interface KioskTextTokens {
  /** Primary text (names, headings) on neutral page/card surfaces */
  textStrong: string
  /** Secondary body text on neutral surfaces */
  textSoft: string
  /** Muted labels / captions on neutral surfaces */
  textFaint: string
  /** Neutral pill/chip (inactive filter, sort, search) — bg + border + text */
  neutralChip: string
}

/**
 * Text colors that adapt to whether the kiosk theme is light or dark.
 * Buttons keep their own (white) text; these are for text on neutral
 * page / card backgrounds where a light theme needs dark text.
 */
export function kioskTextTokens(theme: KioskTheme): KioskTextTokens {
  if (LIGHT_KIOSK_THEMES.includes(theme)) {
    return {
      textStrong: 'text-slate-900',
      textSoft: 'text-slate-600',
      textFaint: 'text-slate-500',
      neutralChip: 'bg-white border border-sky-200/80 text-slate-700 hover:bg-sky-50',
    }
  }
  return {
    textStrong: 'text-white',
    textSoft: 'text-gray-300',
    textFaint: 'text-gray-400',
    neutralChip: 'bg-white/10 border border-white/15 text-gray-200 hover:bg-white/20',
  }
}

