'use client'

import { useState, useEffect, use, useMemo, useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Survey, Question } from '@prisma/client'
import { CheckCircle, Play, User, Home, Maximize, Minimize, ClipboardList, Users, Search, Clock3, MoreVertical } from 'lucide-react'
import Image from 'next/image'
import { validatePlayerPassword } from '@/lib/passwordUtils'
import { isRecurringSurveyActive } from '@/lib/recurringSurvey'
import { pushRecentPlayerId, readRecentPlayerIds } from '@/lib/kioskRecentPlayers'
import { flushOfflineSurveyQueue, getOfflineQueueCount } from '@/lib/offlineSurveyQueue'
import KioskPasswordPrompt from '@/components/KioskPasswordPrompt'
import KioskClubBrand from '@/components/KioskClubBrand'
import { kioskThemes, kioskTextTokens, KioskTheme } from '@/lib/kioskThemes'
import { surveyThemeFromKiosk } from '@/lib/surveyFormAppearance'

const CoachModeView = dynamic(() => import('@/components/CoachModeView'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-white/70">
      Loading coach mode…
    </div>
  ),
})

type StatusFilter = 'pending' | 'done' | 'all'

async function enterFullscreenIfMobile() {
  if (typeof window === 'undefined' || window.innerWidth > 768) return
  try {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>
      msRequestFullscreen?: () => Promise<void>
    }
    if (el.requestFullscreen) await el.requestFullscreen()
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
    else if (el.msRequestFullscreen) await el.msRequestFullscreen()
  } catch (error) {
    console.error('Error entering fullscreen:', error)
  }
}

interface PlayerWithStatus {
  id: string
  firstName: string
  lastName: string
  image: string | null
  password: string
  hasResponded: boolean
  responseId?: string
}

type KioskBootstrap = {
  survey: Survey & { questions?: Question[] }
  kioskSettings: {
    password?: string
    coachPassword?: string
    theme?: KioskTheme
    clubName?: string
    clubLogo?: string | null
    showClubBranding?: boolean
  } | null
  adminAccessPassword?: string
  tags: Array<{ name: string; category: string }>
  players: PlayerWithStatus[]
}

async function hydrateKioskAvatars(
  surveyId: string,
  setPlayers: Dispatch<SetStateAction<PlayerWithStatus[]>>,
) {
  try {
    const res = await fetch(`/api/kiosk/${surveyId}/avatars`, { cache: 'default' })
    if (!res.ok) return
    const data = (await res.json()) as { avatars?: Record<string, string> }
    const avatars = data.avatars || {}
    if (!Object.keys(avatars).length) return
    setPlayers((prev) =>
      prev.map((p) => (avatars[p.id] ? { ...p, image: avatars[p.id] } : p)),
    )
  } catch (error) {
    console.error('Avatar hydrate failed:', error)
  }
}

function kioskPlayerInitial(player: Pick<PlayerWithStatus, 'firstName' | 'lastName'>): string {
  const s = player.firstName?.trim() || player.lastName?.trim()
  if (!s) return '?'
  return s.slice(0, 1).toLocaleUpperCase()
}

/** Title-case each word: "DOBROSAVLEVICI" / "DE KAMPS" → "Dobrosavlevici" / "De Kamps" */
function formatKioskSurname(lastName: string): string {
  return lastName
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toLocaleUpperCase() + w.slice(1).toLocaleLowerCase() : ''))
    .join(' ')
}

export default function KioskModePage({ params }: { params: Promise<{ surveyId: string }> }) {
  const router = useRouter()
  const { surveyId } = use(params)
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [players, setPlayers] = useState<PlayerWithStatus[]>([])
  const [selectedLetter, setSelectedLetter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [submitToast, setSubmitToast] = useState(false)
  const [queuedToast, setQueuedToast] = useState(false)
  const [syncToast, setSyncToast] = useState<string | null>(null)
  const [playerAuthError, setPlayerAuthError] = useState<string | null>(null)
  const [showResubmitConfirm, setShowResubmitConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminAccessPassword, setAdminAccessPassword] = useState('123')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [playerPassword, setPlayerPassword] = useState('')
  const [showPlayerPasswordModal, setShowPlayerPasswordModal] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithStatus | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showKioskPassword, setShowKioskPassword] = useState(false)
  const [surveyNotActive, setSurveyNotActive] = useState(false)
  const [surveyStatusMessage, setSurveyStatusMessage] = useState('')
  const [kioskTheme, setKioskTheme] = useState<KioskTheme>('dark')
  const [clubName, setClubName] = useState('')
  const [clubLogo, setClubLogo] = useState<string | null>(null)
  const [showClubBranding, setShowClubBranding] = useState(true)
  const [isCoachMode, setIsCoachMode] = useState(false)
  const [surveyQuestions, setSurveyQuestions] = useState<Question[]>([])
  const [sessionTags, setSessionTags] = useState<string[]>([])
  const [matchDayTags, setMatchDayTags] = useState<string[]>([])
  const [coachPassword, setCoachPassword] = useState('')
  const [storedCoachPassword, setStoredCoachPassword] = useState('')
  const [kioskGatePassword, setKioskGatePassword] = useState<string | null>(null)
  const [showCoachPasswordModal, setShowCoachPasswordModal] = useState(false)
  const [coachAuthenticated, setCoachAuthenticated] = useState(false)
  const [staffMenuOpen, setStaffMenuOpen] = useState(false)
  const staffMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!staffMenuOpen) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const el = staffMenuRef.current
      if (el && !el.contains(e.target as Node)) setStaffMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStaffMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [staffMenuOpen])

  const applyBootstrap = useCallback((data: KioskBootstrap) => {
    const ks = data.kioskSettings
    setKioskTheme(ks?.theme ?? 'dark')
    setStoredCoachPassword(ks?.coachPassword ?? '')
    setKioskGatePassword(ks?.password ?? '')
    setClubName(ks?.clubName ?? '')
    setClubLogo(ks?.clubLogo ?? null)
    setShowClubBranding(ks?.showClubBranding ?? true)
    if (data.adminAccessPassword) {
      setAdminAccessPassword(data.adminAccessPassword)
    }

    const tagRows = data.tags || []
    setSessionTags(tagRows.filter((t) => t.category === 'SESSION').map((t) => t.name))
    setMatchDayTags(tagRows.filter((t) => t.category === 'MATCHDAY').map((t) => t.name))

    setSurvey(data.survey)
    // Questions are loaded lazily for coach mode (keeps open path tiny)
    if (data.survey?.questions?.length) setSurveyQuestions(data.survey.questions)
    setPlayers(data.players || [])

    if (data.survey?.isRecurring) {
      const status = isRecurringSurveyActive(data.survey)
      if (!status.isCurrentlyActive) {
        setSurveyNotActive(true)
        setSurveyStatusMessage(status.statusMessage)
      } else {
        setSurveyNotActive(false)
        setSurveyStatusMessage('')
      }
    } else {
      setSurveyNotActive(false)
      setSurveyStatusMessage('')
    }
  }, [])

  const loadBootstrap = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setIsLoading(true)
      try {
        const res = await fetch(`/api/kiosk/${surveyId}/bootstrap`, {
          cache: 'no-store',
        })
        if (!res.ok) {
          console.error('Kiosk bootstrap failed', res.status)
          return
        }
        const data = (await res.json()) as KioskBootstrap
        applyBootstrap(data)

        const password = data.kioskSettings?.password?.trim() || ''
        if (password) {
          const alreadyAuthed =
            typeof window !== 'undefined' &&
            sessionStorage.getItem(`kiosk-auth-${surveyId}`) === 'true'
          setShowKioskPassword(!alreadyAuthed)
        } else {
          setShowKioskPassword(false)
        }

        // Show UI immediately; photos fill in after (were ~12MB blocking open)
        void hydrateKioskAvatars(surveyId, setPlayers)
      } catch (error) {
        console.error('Error loading kiosk bootstrap:', error)
      } finally {
        if (!opts?.silent) setIsLoading(false)
      }
    },
    [surveyId, applyBootstrap],
  )

  useEffect(() => {
    void loadBootstrap()
  }, [loadBootstrap])

  useEffect(() => {
    setRecentIds(readRecentPlayerIds(surveyId))
  }, [surveyId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const submitted = params.get('submitted') === '1'
    const queued = params.get('queued') === '1'
    if (!submitted && !queued) return
    if (submitted) setSubmitToast(true)
    if (queued) setQueuedToast(true)
    setStatusFilter('pending')
    params.delete('submitted')
    params.delete('queued')
    const next = params.toString()
    const cleanUrl = `${window.location.pathname}${next ? `?${next}` : ''}`
    window.history.replaceState({}, '', cleanUrl)
    const timer = window.setTimeout(() => {
      setSubmitToast(false)
      setQueuedToast(false)
    }, 3600)
    return () => window.clearTimeout(timer)
  }, [surveyId])

  useEffect(() => {
    const syncOffline = async () => {
      const before = getOfflineQueueCount()
      const result = await flushOfflineSurveyQueue()
      if (result.synced > 0) {
        setSyncToast(
          result.synced === 1
            ? '1 offline response synced'
            : `${result.synced} offline responses synced`
        )
        window.setTimeout(() => setSyncToast(null), 4000)
        await loadBootstrap({ silent: true })
      } else if (before > 0 && result.remaining > 0) {
        setSyncToast(`${result.remaining} waiting to sync when online`)
        window.setTimeout(() => setSyncToast(null), 4000)
      }
    }

    void syncOffline()
    const onOnline = () => {
      void syncOffline()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [surveyId, loadBootstrap])

  const handleKioskPasswordCorrect = () => {
    setShowKioskPassword(false)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`kiosk-auth-${surveyId}`, 'true')
    }
    // Bootstrap already loaded players/survey while password screen was up
  }


  const handlePlayerClick = (player: PlayerWithStatus) => {
    setSelectedPlayer(player)
    setPlayerAuthError(null)
    setShowResubmitConfirm(false)
    setPlayerPassword('')
    setShowPlayerPasswordModal(true)
  }

  const buildSurveyHref = (pid: string) => {
    const q = new URLSearchParams({ playerId: pid })
    const appearance = surveyThemeFromKiosk(kioskTheme)
    if (appearance) q.set('surveyTheme', appearance)
    return `/survey/${surveyId}?${q.toString()}`
  }

  const startSurveyForPlayer = async (player: PlayerWithStatus) => {
    pushRecentPlayerId(surveyId, player.id)
    setRecentIds(readRecentPlayerIds(surveyId))
    setShowPlayerPasswordModal(false)
    setShowResubmitConfirm(false)
    setPlayerPassword('')
    setPlayerAuthError(null)
    setSelectedPlayer(null)
    await enterFullscreenIfMobile()
    router.push(buildSurveyHref(player.id))
  }

  const handlePlayerPasswordSubmit = async () => {
    if (!selectedPlayer) return

    if (
      !validatePlayerPassword(
        playerPassword,
        selectedPlayer.firstName,
        selectedPlayer.lastName,
        selectedPlayer.password ?? undefined
      )
    ) {
      setPlayerAuthError('Incorrect password. Try again.')
      setPlayerPassword('')
      return
    }

    setPlayerAuthError(null)

    if (selectedPlayer.hasResponded) {
      setShowResubmitConfirm(true)
      return
    }

    await startSurveyForPlayer(selectedPlayer)
  }

  const handlePlayerPasswordCancel = () => {
    setShowPlayerPasswordModal(false)
    setShowResubmitConfirm(false)
    setPlayerPassword('')
    setPlayerAuthError(null)
    setSelectedPlayer(null)
  }

  const handleHomeClick = () => {
    setShowPasswordModal(true)
  }

  const handlePasswordSubmit = () => {
    if (adminPassword.trim() === adminAccessPassword) {
      router.push('/')
    } else {
      alert('Incorrect password')
      setAdminPassword('')
    }
  }

  const handlePasswordCancel = () => {
    setShowPasswordModal(false)
    setAdminPassword('')
  }

  const getAlphabet = () => {
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  }

  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen()
        } else if ((document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
          await (document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen!()
        } else if ((document.documentElement as HTMLElement & { msRequestFullscreen?: () => Promise<void> }).msRequestFullscreen) {
          await (document.documentElement as HTMLElement & { msRequestFullscreen?: () => Promise<void> }).msRequestFullscreen!()
        }
        setIsFullscreen(true)
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if ((document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen) {
          await (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen!()
        } else if ((document as Document & { msExitFullscreen?: () => Promise<void> }).msExitFullscreen) {
          await (document as Document & { msExitFullscreen?: () => Promise<void> }).msExitFullscreen!()
        }
        setIsFullscreen(false)
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error)
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('msfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('msfullscreenchange', handleFullscreenChange)
    }
  }, [surveyId])

  const ensureCoachQuestions = useCallback(async () => {
    if (surveyQuestions.length > 0) return
    try {
      const res = await fetch(`/api/surveys/${surveyId}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data?.questions)) {
        setSurveyQuestions(data.questions)
      }
    } catch (error) {
      console.error('Failed to load survey questions for coach mode:', error)
    }
  }, [surveyId, surveyQuestions.length])

  const enterCoachMode = useCallback(() => {
    setIsCoachMode(true)
    void ensureCoachQuestions()
  }, [ensureCoachQuestions])

  const handleCoachToggle = () => {
    if (isCoachMode) {
      setIsCoachMode(false)
      return
    }
    if (storedCoachPassword && storedCoachPassword.trim() !== '' && !coachAuthenticated) {
      setShowCoachPasswordModal(true)
      return
    }
    enterCoachMode()
  }

  const handleCoachPasswordSubmit = () => {
    if (coachPassword.trim() === storedCoachPassword.trim()) {
      setCoachAuthenticated(true)
      setShowCoachPasswordModal(false)
      setCoachPassword('')
      enterCoachMode()
    } else {
      alert('Incorrect password. Please try again.')
      setCoachPassword('')
    }
  }

  const handleCoachPasswordCancel = () => {
    setShowCoachPasswordModal(false)
    setCoachPassword('')
  }

  const pendingCount = useMemo(() => players.filter((p) => !p.hasResponded).length, [players])
  const doneCount = useMemo(() => players.filter((p) => p.hasResponded).length, [players])

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let list = players

    if (statusFilter === 'pending') list = list.filter((p) => !p.hasResponded)
    if (statusFilter === 'done') list = list.filter((p) => p.hasResponded)

    if (selectedLetter) {
      list = list.filter((p) => p.lastName.toUpperCase().startsWith(selectedLetter))
    }

    if (q) {
      list = list.filter((p) => {
        const full = `${p.firstName} ${p.lastName}`.toLowerCase()
        return (
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          full.includes(q)
        )
      })
    }

    return [...list].sort((a, b) => {
      if (statusFilter === 'all' && a.hasResponded !== b.hasResponded) {
        return Number(a.hasResponded) - Number(b.hasResponded)
      }
      const byLast = a.lastName.localeCompare(b.lastName)
      if (byLast !== 0) return byLast
      return a.firstName.localeCompare(b.firstName)
    })
  }, [players, searchQuery, selectedLetter, statusFilter])

  const recentPlayers = useMemo(() => {
    if (recentIds.length === 0) return []
    const byId = new Map(players.map((p) => [p.id, p]))
    return recentIds.map((id) => byId.get(id)).filter((p): p is PlayerWithStatus => Boolean(p))
  }, [players, recentIds])

  const activeTheme = kioskThemes[kioskTheme] ?? kioskThemes.dark
  const text = kioskTextTokens(kioskTheme)

  const renderPlayerCard = (player: PlayerWithStatus) => (
    <button
      key={player.id}
      type="button"
      onClick={() => handlePlayerClick(player)}
      className={`group relative m-0 min-w-0 w-full appearance-none text-left backdrop-blur-xl rounded-2xl sm:rounded-3xl border-solid shadow-2xl hover:shadow-3xl cursor-pointer transition-[transform,box-shadow] duration-300 ease-out transform hover:scale-[1.02] hover:-translate-y-px focus-visible:z-10 focus-visible:scale-[1.02] focus-visible:-translate-y-px p-3 sm:p-6 lg:p-8 ${activeTheme.playerCardFocus} ${
        player.hasResponded ? activeTheme.playerCardResponded : activeTheme.playerCardIdle
      }`}
    >
      {player.hasResponded && (
        <div className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-r from-green-500/90 to-emerald-500/90 rounded-full flex items-center justify-center shadow-2xl border-2 border-green-400/50 backdrop-blur-sm">
          <CheckCircle className="w-6 h-6 text-white drop-shadow-lg" />
        </div>
      )}

      <div className="flex justify-center mb-4 sm:mb-6">
        <div className="relative">
          {player.image ? (
            <Image
              src={player.image}
              alt={`${player.firstName} ${player.lastName}`}
              width={128}
              height={128}
              className="h-20 w-20 rounded-full border-2 border-slate-600/50 object-cover shadow-2xl backdrop-blur-sm transition-all duration-500 group-hover:border-blue-400/60 sm:h-24 sm:w-24 sm:border-[3px] lg:h-28 lg:w-28"
            />
          ) : (
            <div
              className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-slate-600/50 shadow-2xl backdrop-blur-sm transition-all duration-500 sm:h-24 sm:w-24 sm:border-[3px] lg:h-28 lg:w-28 ${activeTheme.playerAvatarInitial}`}
            >
              <span className="select-none text-2xl font-bold leading-none tracking-tight sm:text-3xl lg:text-4xl" aria-hidden>
                {kioskPlayerInitial(player)}
              </span>
            </div>
          )}

          <div
            className={`absolute inset-0 rounded-full transition-all duration-500 ${
              player.hasResponded
                ? 'bg-green-400/20 group-hover:bg-green-400/40 shadow-lg shadow-green-400/20'
                : 'bg-blue-400/0 group-hover:bg-blue-400/30 group-hover:shadow-lg group-hover:shadow-blue-400/20'
            }`}
          />

          <div
            className={`absolute inset-0 rounded-full border-2 transition-all duration-500 ${
              player.hasResponded
                ? 'border-green-400/30 group-hover:border-green-400/60'
                : 'border-transparent group-hover:border-blue-400/40'
            }`}
          />
        </div>
      </div>

      <div className="w-full min-w-0 px-1 text-center sm:px-1.5">
        <h3 className={`text-[11px] sm:text-sm lg:text-base font-medium leading-tight ${text.textFaint} tracking-wide transition-colors duration-300`}>
          {player.firstName}
        </h3>
        <p className={`mt-0.5 w-full max-w-full break-words text-[10px] font-bold normal-case leading-tight tracking-tight ${text.textStrong} transition-colors duration-300 sm:text-[11px] md:text-xs lg:text-sm`}>
          {formatKioskSurname(player.lastName)}
        </p>

        {player.hasResponded ? (
          <div className="mt-3 flex w-full justify-center">
            <div className="inline-flex items-center gap-1 rounded-full border border-green-400/30 bg-green-900/40 px-2 py-1 text-xs font-semibold text-green-300 backdrop-blur-sm shadow-lg sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm">
              <CheckCircle className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" aria-hidden />
              <span>Done</span>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex w-full justify-center">
            <div className={`${activeTheme.playerStatusIdlePill}`}>
              <Play className="h-3 w-3 shrink-0 opacity-90 sm:h-3.5 sm:w-3.5" aria-hidden />
              <span>Start</span>
            </div>
          </div>
        )}
      </div>

      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-cyan-500/0 group-hover:from-blue-500/10 group-hover:via-purple-500/5 group-hover:to-cyan-500/10 transition-all duration-500 pointer-events-none" />
      <div className="absolute inset-0 rounded-3xl border-2 border-transparent group-hover:border-blue-400/20 transition-all duration-500 pointer-events-none" />
    </button>
  )

  // Show kiosk password prompt if needed
  if (showKioskPassword) {
    return (
      <KioskPasswordPrompt
        surveyId={surveyId}
        expectedPassword={kioskGatePassword}
        theme={kioskTheme}
        clubName={clubName}
        clubLogo={clubLogo}
        showClubBranding={showClubBranding}
        onPasswordCorrect={handleKioskPasswordCorrect}
        onCancel={() => router.push('/')}
      />
    )
  }

  if (isLoading) {
    return (
      <div className={`min-h-screen ${activeTheme.rootBackground} flex items-center justify-center p-6`}>
        <div className="text-center max-w-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-500 border-t-blue-500 mx-auto" aria-hidden />
          <p className={`mt-6 text-lg font-medium ${text.textStrong}`}>Opening survey…</p>
          <p className={`mt-2 text-sm ${text.textFaint}`}>
            Please wait — this may take a moment on a slower connection.
          </p>
        </div>
      </div>
    )
  }

  if (!survey) {
    return (
      <div className={`min-h-screen ${activeTheme.rootBackground} flex items-center justify-center`}>
        <div className="text-center">
          <h1 className={`text-2xl font-bold ${text.textStrong} mb-4`}>Survey Not Found</h1>
          <p className={text.textSoft}>The requested survey could not be found.</p>
        </div>
      </div>
    )
  }

  if (surveyNotActive) {
    return (
      <div className={`min-h-screen ${activeTheme.rootBackground} flex items-center justify-center p-4`}>
        <div className={`max-w-md w-full ${activeTheme.modalBackground} backdrop-blur-xl rounded-2xl shadow-2xl p-8 text-center`}>
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className={`text-3xl font-bold ${text.textStrong} mb-3`}>Survey Not Available</h1>
          <div className="w-16 h-0.5 bg-gradient-to-r from-orange-400 to-red-400 rounded-full mx-auto mb-6"></div>
          <p className={`${text.textSoft} text-lg mb-6`}>{surveyStatusMessage}</p>
          <p className={`text-sm ${text.textFaint}`}>
            Survey: <span className={`${text.textStrong} font-semibold`}>{survey.title}</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
          overflow: auto;
        }
        html {
          margin: 0;
          padding: 0;
        }
        @media (max-width: 768px) {
          body {
            font-size: 16px;
            -webkit-text-size-adjust: 100%;
          }
        }
      `}</style>
      <div className={`${isFullscreen ? 'fixed inset-0' : 'min-h-screen'} ${activeTheme.rootBackground} relative overflow-auto`}>
        <a
          href="#kiosk-player-grid"
          className="sr-only focus:fixed focus:left-4 focus:top-20 focus:z-[80] focus:inline-flex focus:h-auto focus:min-h-0 focus:w-auto focus:overflow-visible focus:whitespace-nowrap focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          Skip to player list
        </a>
      {/* Futuristic Background Effects */}
      <div className={`absolute inset-0 ${activeTheme.overlayOne}`}></div>
      <div className={`absolute top-0 left-0 w-full h-full ${activeTheme.overlayTwo}`}></div>
      
      {/* Kiosk Header — player-first; staff actions in discreet menu */}
      <header className={`sticky top-0 z-30 ${activeTheme.headerBackground}`}>
        <div className={`absolute inset-0 ${activeTheme.headerOverlay}`} aria-hidden />
        <div className="relative mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
          {showClubBranding && (clubName || clubLogo) ? (
            <KioskClubBrand
              clubName={clubName}
              clubLogo={clubLogo}
              showBranding={showClubBranding}
              kioskTheme={kioskTheme}
              size="sm"
              logoOnly
              className="shrink-0"
            />
          ) : null}

          <div className="min-w-0 flex-1">
            <h1
              className={`truncate text-[1.15rem] font-semibold tracking-tight sm:text-xl lg:text-2xl ${text.textStrong}`}
            >
              {survey.title}
            </h1>
            <p className={`mt-0.5 truncate text-xs sm:text-sm ${text.textSoft}`}>
              {isCoachMode ? 'Coach mode · fill in for each player' : 'Tap your name to start'}
            </p>
          </div>

          <div className="relative shrink-0" ref={staffMenuRef}>
            <button
              type="button"
              onClick={() => setStaffMenuOpen((o) => !o)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                kioskTheme === 'light' || kioskTheme === 'sand'
                  ? 'border-slate-200/80 bg-white/60 text-slate-600 hover:bg-white'
                  : 'border-white/10 bg-black/20 text-white/55 hover:bg-white/10 hover:text-white/85'
              } ${isCoachMode ? 'ring-2 ring-teal-400/50' : ''}`}
              aria-label="Staff menu"
              aria-haspopup="menu"
              aria-expanded={staffMenuOpen}
              title="Staff"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {staffMenuOpen ? (
              <div
                role="menu"
                className={`absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl ${
                  kioskTheme === 'light' || kioskTheme === 'sand'
                    ? 'border-slate-200 bg-white/95 text-slate-800'
                    : 'border-white/10 bg-slate-950/95 text-white'
                }`}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setStaffMenuOpen(false)
                    handleCoachToggle()
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-sm font-medium transition-colors ${
                    kioskTheme === 'light' || kioskTheme === 'sand'
                      ? 'hover:bg-slate-100'
                      : 'hover:bg-white/8'
                  }`}
                >
                  {isCoachMode ? <Users className="h-4 w-4 opacity-70" /> : <ClipboardList className="h-4 w-4 opacity-70" />}
                  {isCoachMode ? 'Player mode' : 'Coach mode'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setStaffMenuOpen(false)
                    handleHomeClick()
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-sm font-medium transition-colors ${
                    kioskTheme === 'light' || kioskTheme === 'sand'
                      ? 'hover:bg-slate-100'
                      : 'hover:bg-white/8'
                  }`}
                >
                  <Home className="h-4 w-4 opacity-70" />
                  Admin
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setStaffMenuOpen(false)
                    void toggleFullscreen()
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-sm font-medium transition-colors ${
                    kioskTheme === 'light' || kioskTheme === 'sand'
                      ? 'hover:bg-slate-100'
                      : 'hover:bg-white/8'
                  }`}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4 opacity-70" /> : <Maximize className="h-4 w-4 opacity-70" />}
                  {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Futuristic Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`relative ${activeTheme.modalBackground} backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4`}>
            <div className={`absolute inset-0 ${activeTheme.modalOverlay} rounded-2xl`}></div>
            <div className="relative">
              <h3 className={`text-2xl font-light ${text.textStrong} mb-2 tracking-wide`}>Admin Access Required</h3>
              <div className={`w-16 h-0.5 ${activeTheme.accentLine} rounded-full mb-6`}></div>
              <p className={`text-base ${text.textSoft} mb-6 tracking-wide`}>Enter password to access admin dashboard:</p>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                className={`w-full px-4 py-4 rounded-xl backdrop-blur-sm text-base tracking-wide focus:outline-none ${activeTheme.inputField} mb-6`}
                placeholder="Enter password..."
                autoFocus
              />
              <div className="flex space-x-4">
                <button
                  onClick={handlePasswordSubmit}
                  className={`flex-1 ${activeTheme.primaryButton} text-white px-6 py-3 rounded-xl text-base font-semibold transition-all duration-300 backdrop-blur-sm`}
                >
                  Access Admin
                </button>
                <button
                  onClick={handlePasswordCancel}
                  className={`flex-1 ${activeTheme.adminButton} text-white px-6 py-3 rounded-xl text-base font-semibold transition-all duration-300 backdrop-blur-sm`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Player Password / Resubmit Modal */}
      {showPlayerPasswordModal && selectedPlayer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`relative ${activeTheme.modalBackground} backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4`}>
            <div className={`absolute inset-0 ${activeTheme.modalOverlay} rounded-2xl`}></div>
            <div className="relative">
              {showResubmitConfirm ? (
                <>
                  <h3 className={`text-2xl font-light ${text.textStrong} mb-2 text-center tracking-wide`}>Already submitted</h3>
                  <div className={`w-16 h-0.5 ${activeTheme.accentLine} rounded-full mx-auto mb-6`}></div>
                  <p className={`text-base ${text.textSoft} mb-6 text-center tracking-wide`}>
                    <strong className={text.textStrong}>{selectedPlayer.firstName} {selectedPlayer.lastName}</strong> already completed this survey. Submit again?
                  </p>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => startSurveyForPlayer(selectedPlayer)}
                      className={`flex-1 ${activeTheme.primaryButton} text-white px-6 py-3 rounded-xl text-base font-semibold transition-all duration-300 backdrop-blur-sm`}
                    >
                      Submit again
                    </button>
                    <button
                      onClick={handlePlayerPasswordCancel}
                      className={`flex-1 ${activeTheme.adminButton} text-white px-6 py-3 rounded-xl text-base font-semibold transition-all duration-300 backdrop-blur-sm`}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className={`text-2xl font-light ${text.textStrong} mb-2 text-center tracking-wide`}>Player Authentication</h3>
                  <div className={`w-16 h-0.5 ${activeTheme.accentLine} rounded-full mx-auto mb-6`}></div>
                  <p className={`text-base ${text.textSoft} mb-4 text-center tracking-wide`}>
                    Enter password for <strong className={text.textStrong}>{selectedPlayer.firstName} {selectedPlayer.lastName}</strong>:
                  </p>
                  <input
                    type="text"
                    value={playerPassword}
                    onChange={(e) => {
                      setPlayerAuthError(null)
                      setPlayerPassword(e.target.value.toUpperCase())
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handlePlayerPasswordSubmit()}
                    className={`w-full px-3 py-2 sm:px-4 sm:py-4 rounded-xl focus:outline-none text-center text-lg sm:text-2xl font-mono tracking-widest backdrop-blur-sm ${activeTheme.inputField} ${
                      playerAuthError ? 'ring-2 ring-red-400/80' : ''
                    }`}
                    placeholder=""
                    autoFocus
                    maxLength={10}
                    autoComplete="off"
                    inputMode="text"
                  />
                  {playerAuthError ? (
                    <p className="mt-3 text-center text-sm font-medium text-red-300" role="alert">
                      {playerAuthError}
                    </p>
                  ) : (
                    <div className="mt-3 h-5" aria-hidden />
                  )}
                  <div className="mt-3 flex space-x-4">
                    <button
                      onClick={handlePlayerPasswordSubmit}
                      className={`flex-1 ${activeTheme.primaryButton} text-white px-6 py-3 rounded-xl text-base font-semibold transition-all duration-300 backdrop-blur-sm`}
                    >
                      Continue
                    </button>
                    <button
                      onClick={handlePlayerPasswordCancel}
                      className={`flex-1 ${activeTheme.adminButton} text-white px-6 py-3 rounded-xl text-base font-semibold transition-all duration-300 backdrop-blur-sm`}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {submitToast && (
        <div className="fixed top-4 left-1/2 z-[70] w-[min(92vw,28rem)] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-950/90 px-4 py-3 text-emerald-100 shadow-2xl backdrop-blur-xl">
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-wide">Survey submitted</p>
              <p className="text-xs text-emerald-200/80">Ready for the next player.</p>
            </div>
          </div>
        </div>
      )}

      {queuedToast && (
        <div className="fixed top-4 left-1/2 z-[70] w-[min(92vw,28rem)] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-950/90 px-4 py-3 text-amber-50 shadow-2xl backdrop-blur-xl">
            <Clock3 className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-wide">Saved offline on this tablet</p>
              <p className="text-xs text-amber-100/80">Will sync automatically when the network returns.</p>
            </div>
          </div>
        </div>
      )}

      {syncToast && (
        <div className="fixed top-4 left-1/2 z-[70] w-[min(92vw,28rem)] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-sky-400/40 bg-sky-950/90 px-4 py-3 text-sky-50 shadow-2xl backdrop-blur-xl">
            <CheckCircle className="h-5 w-5 shrink-0 text-sky-300" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-wide">{syncToast}</p>
            </div>
          </div>
        </div>
      )}

      {/* Coach Password Modal */}
      {showCoachPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`relative ${activeTheme.modalBackground} backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4`}>
            <div className={`absolute inset-0 ${activeTheme.modalOverlay} rounded-2xl`}></div>
            <div className="relative">
              <h3 className={`text-2xl font-light ${text.textStrong} mb-2 text-center tracking-wide`}>Coach Access</h3>
              <div className={`w-16 h-0.5 ${activeTheme.accentLine} rounded-full mx-auto mb-6`}></div>
              <p className={`text-base ${text.textSoft} mb-6 text-center tracking-wide`}>
                Enter password to access Coach Mode
              </p>
              <input
                type="password"
                value={coachPassword}
                onChange={(e) => setCoachPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCoachPasswordSubmit()}
                className={`w-full px-4 py-4 rounded-xl backdrop-blur-sm text-base tracking-wide focus:outline-none ${activeTheme.inputField} mb-6`}
                placeholder="Enter coach password..."
                autoFocus
              />
              <div className="flex space-x-4">
                <button
                  onClick={handleCoachPasswordSubmit}
                  className={`flex-1 ${activeTheme.primaryButton} text-white px-6 py-3 rounded-xl text-base font-semibold transition-all duration-300 backdrop-blur-sm`}
                >
                  Enter Coach Mode
                </button>
                <button
                  onClick={handleCoachPasswordCancel}
                  className={`flex-1 ${activeTheme.adminButton} text-white px-6 py-3 rounded-xl text-base font-semibold transition-all duration-300 backdrop-blur-sm`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCoachMode && survey ? (
        surveyQuestions.length > 0 ? (
        <CoachModeView
          survey={{ ...survey, questions: surveyQuestions }}
          players={players}
          kioskTheme={kioskTheme}
          sessionTags={sessionTags}
          matchDayTags={matchDayTags}
          onBack={() => setIsCoachMode(false)}
          onRefresh={() => {
            void loadBootstrap({ silent: true })
            void hydrateKioskAvatars(surveyId, setPlayers)
          }}
        />
        ) : (
          <div className={`flex min-h-screen items-center justify-center ${activeTheme.rootBackground}`}>
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-500 border-t-teal-400" />
              <p className={`mt-4 text-sm ${text.textSoft}`}>Loading coach mode…</p>
            </div>
          </div>
        )
      ) : (
      <>
      <div className={`relative ${activeTheme.panelBackground} backdrop-blur-xl py-4 sm:py-8`}>
        <div className={`absolute inset-0 ${activeTheme.panelOverlay}`}></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 space-y-5 sm:space-y-6">
          <div className="text-center">
            <h2 id="kiosk-filter-heading" className={`text-lg sm:text-2xl font-light ${text.textStrong} mb-2 sm:mb-3 tracking-wide`}>
              Find your name
            </h2>
            <div className={`w-16 sm:w-20 h-0.5 ${activeTheme.accentLine} rounded-full mx-auto mb-2 sm:mb-3`}></div>
            <p className={`text-sm sm:text-base ${text.textSoft} tracking-wide`}>
              Pending first — search or filter to start faster
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {(
              [
                { id: 'pending', label: `Pending (${pendingCount})` },
                { id: 'done', label: `Done (${doneCount})` },
                { id: 'all', label: `All (${players.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-4 py-2.5 rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 shadow-lg backdrop-blur-sm ${
                  statusFilter === tab.id ? activeTheme.letterActive : activeTheme.letterInactive
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative max-w-xl mx-auto">
            <Search className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${text.textFaint}`} aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name…"
              className={`w-full rounded-xl py-3 pl-11 pr-4 text-base backdrop-blur-sm focus:outline-none ${activeTheme.inputField}`}
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>

          <nav aria-labelledby="kiosk-filter-heading" className="flex flex-wrap gap-2 sm:gap-3 justify-center">
            <button
              onClick={() => setSelectedLetter('')}
              className={`px-3 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg backdrop-blur-sm ${
                !selectedLetter ? activeTheme.letterActive : activeTheme.letterInactive
              }`}
            >
              A–Z
            </button>
            {getAlphabet().map((letter) => {
              const hasPlayers = players.some((p) => p.lastName.toUpperCase().startsWith(letter))
              return (
                <button
                  key={letter}
                  onClick={() => setSelectedLetter(letter)}
                  disabled={!hasPlayers}
                  className={`px-3 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg backdrop-blur-sm ${
                    selectedLetter === letter
                      ? activeTheme.letterActive
                      : hasPlayers
                        ? activeTheme.letterInactive
                        : activeTheme.letterDisabled
                  }`}
                >
                  {letter}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {recentPlayers.length > 0 && !searchQuery.trim() && !selectedLetter && (
        <section aria-label="Recent players" className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
          <div className="mb-3 flex items-center gap-2">
            <Clock3 className={`h-4 w-4 ${text.textFaint}`} aria-hidden />
            <h3 className={`text-sm sm:text-base font-semibold tracking-wide ${text.textSoft}`}>Recent</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {recentPlayers.slice(0, 6).map((player) => renderPlayerCard(player))}
          </div>
        </section>
      )}

      <section
        id="kiosk-player-grid"
        aria-label="Players"
        className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10"
      >
        <div className={`absolute inset-0 ${activeTheme.gridOverlay} rounded-3xl`}></div>
        <div className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-8">
          {filteredPlayers.map((player) => renderPlayerCard(player))}
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-20">
            <div className={`relative ${activeTheme.emptyStateCard} backdrop-blur-xl rounded-3xl p-12 max-w-lg mx-auto shadow-2xl`}>
              <div className={`absolute inset-0 ${activeTheme.modalOverlay} rounded-3xl`}></div>
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-slate-500/80 to-slate-600/80 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl border-2 border-slate-600/50 backdrop-blur-sm">
                  <User className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className={`text-2xl font-light ${text.textStrong} mb-4 tracking-wide`}>
                  {statusFilter === 'pending' && pendingCount === 0 ? 'Everyone is done' : 'No players found'}
                </h3>
                <div className="w-16 h-0.5 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full mx-auto mb-4"></div>
                <p className={`text-base ${text.textSoft} tracking-wide mb-6`}>
                  {statusFilter === 'pending' && pendingCount === 0
                    ? 'All players have submitted. Switch to Done or All if needed.'
                    : selectedLetter
                      ? `No players found starting with "${selectedLetter}"`
                      : searchQuery.trim()
                        ? 'Try a different name spelling'
                        : 'No players available for this survey'}
                </p>
                {statusFilter === 'pending' && pendingCount === 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`${activeTheme.primaryButton} text-white px-6 py-3 rounded-xl text-base font-semibold`}
                  >
                    Show all players
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
      </>
      )}
    </div>
    </>
  )
}
