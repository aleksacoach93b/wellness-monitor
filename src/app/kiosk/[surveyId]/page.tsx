'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Survey, Player, Question } from '@prisma/client'
import { CheckCircle, Play, User, Home, Maximize, Minimize, ClipboardList, Users } from 'lucide-react'
import Image from 'next/image'
import { validatePlayerPassword } from '@/lib/passwordUtils'
import { isRecurringSurveyActive } from '@/lib/recurringSurvey'
import KioskPasswordPrompt from '@/components/KioskPasswordPrompt'
import { kioskThemes, KioskTheme } from '@/lib/kioskThemes'
import { surveyThemeFromKiosk } from '@/lib/surveyFormAppearance'
import CoachModeView from '@/components/CoachModeView'

interface PlayerWithStatus extends Player {
  hasResponded: boolean
  responseId?: string
}

function kioskPlayerInitial(player: Pick<Player, 'firstName' | 'lastName'>): string {
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
  const [isCoachMode, setIsCoachMode] = useState(false)
  const [surveyQuestions, setSurveyQuestions] = useState<Question[]>([])
  const [coachPassword, setCoachPassword] = useState('')
  const [storedCoachPassword, setStoredCoachPassword] = useState('')
  const [showCoachPasswordModal, setShowCoachPasswordModal] = useState(false)
  const [coachAuthenticated, setCoachAuthenticated] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Always check kiosk password for each survey
        const kioskResponse = await fetch('/api/kiosk-settings')
        if (kioskResponse.ok) {
          const kioskSettings = await kioskResponse.json()
          setKioskTheme(kioskSettings.theme ?? 'dark')
          setStoredCoachPassword(kioskSettings.coachPassword ?? '')
          // Always show password prompt if password is set
          if (kioskSettings.password && kioskSettings.password.trim() !== '') {
            setShowKioskPassword(true)
            return
          }
        }
        
        // If no password is set, proceed normally
        setShowKioskPassword(false)
        
        // Fetch survey details
        const surveyResponse = await fetch(`/api/surveys/${surveyId}`)
        if (surveyResponse.ok) {
          const surveyData = await surveyResponse.json()
          setSurvey(surveyData)
          if (surveyData.questions) setSurveyQuestions(surveyData.questions)
          
          // Check if recurring survey is currently active
          if (surveyData.isRecurring) {
            const status = isRecurringSurveyActive(surveyData)
            if (!status.isCurrentlyActive) {
              setSurveyNotActive(true)
              setSurveyStatusMessage(status.statusMessage)
              return
            }
          }
        }

        // Fetch players with response status
        const playersResponse = await fetch(`/api/kiosk/${surveyId}/players`)
        if (playersResponse.ok) {
          const playersData = await playersResponse.json()
          setPlayers(playersData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [surveyId])

  useEffect(() => {
    const loadAdminAccessPassword = async () => {
      try {
        const response = await fetch('/api/admin-access')
        if (response.ok) {
          const data = await response.json()
          if (data?.password) {
            setAdminAccessPassword(data.password)
          }
        }
      } catch (error) {
        console.error('Error loading admin access password:', error)
      }
    }

    loadAdminAccessPassword()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Fetch survey details
      const surveyResponse = await fetch(`/api/surveys/${surveyId}`)
      if (surveyResponse.ok) {
        const surveyData = await surveyResponse.json()
        setSurvey(surveyData)
        if (surveyData.questions) setSurveyQuestions(surveyData.questions)
        
        // Check if recurring survey is currently active
        if (surveyData.isRecurring) {
          const status = isRecurringSurveyActive(surveyData)
          if (!status.isCurrentlyActive) {
            setSurveyNotActive(true)
            setSurveyStatusMessage(status.statusMessage)
            return
          }
        }
      }

      // Fetch players with response status
      const playersResponse = await fetch(`/api/kiosk/${surveyId}/players`)
      if (playersResponse.ok) {
        const playersData = await playersResponse.json()
        setPlayers(playersData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKioskPasswordCorrect = () => {
    setShowKioskPassword(false)
    // Fetch data after password is correct
    fetchData()
  }


  const handlePlayerClick = async (player: PlayerWithStatus) => {
    setSelectedPlayer(player)
    setShowPlayerPasswordModal(true)
  }

  const buildSurveyHref = (pid: string) => {
    const q = new URLSearchParams({ playerId: pid })
    const appearance = surveyThemeFromKiosk(kioskTheme)
    if (appearance) q.set('surveyTheme', appearance)
    return `/survey/${surveyId}?${q.toString()}`
  }

  const handlePlayerPasswordSubmit = async () => {
    if (!selectedPlayer) return
    
    // Validate the password
    if (validatePlayerPassword(playerPassword, selectedPlayer.firstName, selectedPlayer.lastName, selectedPlayer.password ?? undefined)) {
      if (selectedPlayer.hasResponded) {
        // If already responded, show a message or allow re-submission
        if (confirm(`${selectedPlayer.firstName} ${selectedPlayer.lastName} has already submitted this survey. Do you want to submit again?`)) {
          // Automatically enter fullscreen for mobile devices
          if (typeof window !== 'undefined' && window.innerWidth <= 768) {
            try {
              if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen()
              } else if ((document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
                await (document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen!()
              } else if ((document.documentElement as HTMLElement & { msRequestFullscreen?: () => Promise<void> }).msRequestFullscreen) {
                await (document.documentElement as HTMLElement & { msRequestFullscreen?: () => Promise<void> }).msRequestFullscreen!()
              }
            } catch (error) {
              console.error('Error entering fullscreen:', error)
            }
          }
          router.push(buildSurveyHref(selectedPlayer.id))
        }
      } else {
        // Automatically enter fullscreen for mobile devices
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
          try {
            if (document.documentElement.requestFullscreen) {
              await document.documentElement.requestFullscreen()
            } else if ((document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
              await (document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen!()
            } else if ((document.documentElement as HTMLElement & { msRequestFullscreen?: () => Promise<void> }).msRequestFullscreen) {
              await (document.documentElement as HTMLElement & { msRequestFullscreen?: () => Promise<void> }).msRequestFullscreen!()
            }
          } catch (error) {
            console.error('Error entering fullscreen:', error)
          }
        }
        router.push(buildSurveyHref(selectedPlayer.id))
      }
      setShowPlayerPasswordModal(false)
      setPlayerPassword('')
      setSelectedPlayer(null)
    } else {
      alert('Incorrect password. Please try again.')
      setPlayerPassword('')
    }
  }

  const handlePlayerPasswordCancel = () => {
    setShowPlayerPasswordModal(false)
    setPlayerPassword('')
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

  const handleCoachToggle = () => {
    if (isCoachMode) {
      setIsCoachMode(false)
      return
    }
    if (storedCoachPassword && storedCoachPassword.trim() !== '' && !coachAuthenticated) {
      setShowCoachPasswordModal(true)
      return
    }
    setIsCoachMode(true)
  }

  const handleCoachPasswordSubmit = () => {
    if (coachPassword.trim() === storedCoachPassword.trim()) {
      setCoachAuthenticated(true)
      setShowCoachPasswordModal(false)
      setCoachPassword('')
      setIsCoachMode(true)
    } else {
      alert('Incorrect password. Please try again.')
      setCoachPassword('')
    }
  }

  const handleCoachPasswordCancel = () => {
    setShowCoachPasswordModal(false)
    setCoachPassword('')
  }

  const getPlayersByLetter = (letter: string) => {
    if (!letter) return players
    return players.filter(player => 
      player.lastName.toUpperCase().startsWith(letter)
    )
  }

  const filteredPlayers = getPlayersByLetter(selectedLetter)
  const activeTheme = kioskThemes[kioskTheme] ?? kioskThemes.dark

  // Show kiosk password prompt if needed
  if (showKioskPassword) {
    return (
      <KioskPasswordPrompt
        theme={kioskTheme}
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
          <p className="mt-6 text-lg font-medium text-white">Opening survey…</p>
          <p className="mt-2 text-sm text-gray-400">
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
          <h1 className="text-2xl font-bold text-white mb-4">Survey Not Found</h1>
          <p className="text-gray-300">The requested survey could not be found.</p>
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
          <h1 className="text-3xl font-bold text-white mb-3">Survey Not Available</h1>
          <div className="w-16 h-0.5 bg-gradient-to-r from-orange-400 to-red-400 rounded-full mx-auto mb-6"></div>
          <p className="text-gray-300 text-lg mb-6">{surveyStatusMessage}</p>
          <p className="text-sm text-gray-400">
            Survey: <span className="text-white font-semibold">{survey.title}</span>
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
      
      {/* Futuristic Header - Mobile Optimized */}
      <div className={`relative ${activeTheme.headerBackground}`}>
        <div className={`absolute inset-0 ${activeTheme.headerOverlay}`}></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-6">
          {/* Mobile Layout */}
          <div className="block sm:hidden">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-light text-white tracking-wide drop-shadow-lg truncate flex-1 mr-2">
                {survey.title}
              </h1>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCoachToggle}
                  className={`${isCoachMode ? activeTheme.primaryButton : activeTheme.secondaryButton} text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-1 text-xs font-semibold transition-all duration-300 backdrop-blur-sm`}
                  title={isCoachMode ? 'Switch to Player Mode' : 'Switch to Coach Mode'}
                >
                  {isCoachMode ? <Users className="h-3 w-3" /> : <ClipboardList className="h-3 w-3" />}
                  <span>{isCoachMode ? 'Players' : 'Coach'}</span>
                </button>
                <button
                  onClick={handleHomeClick}
                  className={`${activeTheme.secondaryButton} text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-1 text-xs font-semibold transition-all duration-300 backdrop-blur-sm`}
                  title="Home (Admin Access Required)"
                >
                  <Home className="h-3 w-3" />
                  <span>Admin</span>
                </button>
                <button
                  onClick={toggleFullscreen}
                  className={`${activeTheme.primaryButton} text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-1 text-xs font-semibold transition-all duration-300 backdrop-blur-sm`}
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isFullscreen ? <Minimize className="h-3 w-3" /> : <Maximize className="h-3 w-3" />}
                  <span>{isFullscreen ? "Exit" : "Full"}</span>
                </button>
              </div>
            </div>
            <p className="text-gray-300 text-sm tracking-wide">
              {isCoachMode ? 'Fill in data for each player' : 'Select your name to begin the survey'}
            </p>
          </div>
          
          {/* Desktop Layout */}
          <div className="hidden sm:block">
            <div className="flex items-center justify-between">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-cyan-600/20 blur-lg"></div>
                <h1 className="relative text-4xl font-light text-white tracking-wider drop-shadow-lg">
                  {survey.title}
                </h1>
                <div className={`relative mt-2 w-32 h-0.5 ${activeTheme.accentLine} rounded-full`}></div>
                <p className="relative mt-3 text-gray-300 text-base tracking-wide">
                  {isCoachMode ? 'Fill in data for each player' : 'Select your name to begin the survey'}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleCoachToggle}
                  className={`relative ${isCoachMode ? activeTheme.primaryButton : activeTheme.secondaryButton} text-white px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 text-sm font-semibold transition-all duration-300 transform hover:scale-105 backdrop-blur-sm`}
                  title={isCoachMode ? 'Switch to Player Mode' : 'Switch to Coach Mode'}
                >
                  {isCoachMode ? <Users className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
                  <span className="tracking-wide">{isCoachMode ? 'Player Mode' : 'Coach Mode'}</span>
                </button>
                <button
                  onClick={toggleFullscreen}
                  className={`relative ${activeTheme.primaryButton} text-white px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 text-sm font-semibold transition-all duration-300 transform hover:scale-105 backdrop-blur-sm`}
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  <span className="tracking-wide">{isFullscreen ? "Exit" : "Full"}</span>
                </button>
                <button
                  onClick={handleHomeClick}
                  className={`relative ${activeTheme.adminButton} text-white px-6 py-3 rounded-xl shadow-xl flex items-center space-x-3 text-base font-semibold transition-all duration-300 transform hover:scale-105 backdrop-blur-sm`}
                  title="Home (Admin Access Required)"
                >
                  <Home className="h-5 w-5" />
                  <span className="tracking-wide">Admin</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Futuristic Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`relative ${activeTheme.modalBackground} backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4`}>
            <div className={`absolute inset-0 ${activeTheme.modalOverlay} rounded-2xl`}></div>
            <div className="relative">
              <h3 className="text-2xl font-light text-white mb-2 tracking-wide">Admin Access Required</h3>
              <div className={`w-16 h-0.5 ${activeTheme.accentLine} rounded-full mb-6`}></div>
              <p className="text-base text-gray-300 mb-6 tracking-wide">Enter password to access admin dashboard:</p>
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

      {/* Futuristic Player Password Modal */}
      {showPlayerPasswordModal && selectedPlayer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`relative ${activeTheme.modalBackground} backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4`}>
            <div className={`absolute inset-0 ${activeTheme.modalOverlay} rounded-2xl`}></div>
            <div className="relative">
              <h3 className="text-2xl font-light text-white mb-2 text-center tracking-wide">Player Authentication</h3>
              <div className={`w-16 h-0.5 ${activeTheme.accentLine} rounded-full mx-auto mb-6`}></div>
              <p className="text-base text-gray-300 mb-6 text-center tracking-wide">
                Enter password for <strong className="text-white">{selectedPlayer.firstName} {selectedPlayer.lastName}</strong>:
              </p>
              <input
                type="text"
                value={playerPassword}
                onChange={(e) => setPlayerPassword(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handlePlayerPasswordSubmit()}
                className={`w-full px-3 py-2 sm:px-4 sm:py-4 rounded-xl focus:outline-none text-center text-lg sm:text-2xl font-mono tracking-widest backdrop-blur-sm mb-6 ${activeTheme.inputField}`}
                placeholder=""
                autoFocus
                maxLength={10}
              />
              <div className="flex space-x-4">
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
              <h3 className="text-2xl font-light text-white mb-2 text-center tracking-wide">Coach Access</h3>
              <div className={`w-16 h-0.5 ${activeTheme.accentLine} rounded-full mx-auto mb-6`}></div>
              <p className="text-base text-gray-300 mb-6 text-center tracking-wide">
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

      {isCoachMode && survey && surveyQuestions.length > 0 ? (
        <CoachModeView
          survey={{ ...survey, questions: surveyQuestions }}
          players={players}
          kioskTheme={kioskTheme}
          onBack={() => setIsCoachMode(false)}
          onRefresh={fetchData}
        />
      ) : (
      <>
      {/* Futuristic Alphabet Navigation - Mobile Optimized */}
      <div className={`relative ${activeTheme.panelBackground} backdrop-blur-xl py-4 sm:py-8`}>
        <div className={`absolute inset-0 ${activeTheme.panelOverlay}`}></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-4 sm:mb-6">
            <h2 id="kiosk-filter-heading" className="text-lg sm:text-2xl font-light text-white mb-2 sm:mb-3 tracking-wide">Filter by Last Name</h2>
            <div className={`w-16 sm:w-20 h-0.5 ${activeTheme.accentLine} rounded-full mx-auto mb-2 sm:mb-3`}></div>
            <p className="text-sm sm:text-base text-gray-300 tracking-wide">Click a letter to filter players</p>
          </div>
          <nav aria-labelledby="kiosk-filter-heading" className="flex flex-wrap gap-2 sm:gap-3 justify-center">
            <button
              onClick={() => setSelectedLetter('')}
              className={`px-3 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg backdrop-blur-sm ${
                !selectedLetter ? activeTheme.letterActive : activeTheme.letterInactive
              }`}
            >
              All
            </button>
            {getAlphabet().map((letter) => {
              const hasPlayers = players.some(p => p.lastName.toUpperCase().startsWith(letter))
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

      {/* Futuristic Players Grid */}
      <section
        id="kiosk-player-grid"
        aria-label="Players"
        className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10"
      >
        <div className={`absolute inset-0 ${activeTheme.gridOverlay} rounded-3xl`}></div>
        <div className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-8">
          {filteredPlayers.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => handlePlayerClick(player)}
              className={`group relative m-0 min-w-0 w-full appearance-none text-left backdrop-blur-xl rounded-2xl sm:rounded-3xl border-solid shadow-2xl hover:shadow-3xl cursor-pointer transition-[transform,box-shadow] duration-300 ease-out transform hover:scale-[1.02] hover:-translate-y-px focus-visible:z-10 focus-visible:scale-[1.02] focus-visible:-translate-y-px p-3 sm:p-6 lg:p-8 ${activeTheme.playerCardFocus} ${
                player.hasResponded ? activeTheme.playerCardResponded : activeTheme.playerCardIdle
              }`}
            >
              {/* Futuristic Status Badge */}
              {player.hasResponded && (
                <div className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-r from-green-500/90 to-emerald-500/90 rounded-full flex items-center justify-center shadow-2xl border-2 border-green-400/50 backdrop-blur-sm">
                  <CheckCircle className="w-6 h-6 text-white drop-shadow-lg" />
                </div>
              )}

              {/* Futuristic Player Photo */}
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
                      <span
                        className="select-none text-2xl font-bold leading-none tracking-tight sm:text-3xl lg:text-4xl"
                        aria-hidden
                      >
                        {kioskPlayerInitial(player)}
                      </span>
                    </div>
                  )}
                  
                  {/* Futuristic glow effect */}
                  <div className={`absolute inset-0 rounded-full transition-all duration-500 ${
                    player.hasResponded 
                      ? 'bg-green-400/20 group-hover:bg-green-400/40 shadow-lg shadow-green-400/20' 
                      : 'bg-blue-400/0 group-hover:bg-blue-400/30 group-hover:shadow-lg group-hover:shadow-blue-400/20'
                  }`}></div>
                  
                  {/* Animated ring */}
                  <div className={`absolute inset-0 rounded-full border-2 transition-all duration-500 ${
                    player.hasResponded 
                      ? 'border-green-400/30 group-hover:border-green-400/60' 
                      : 'border-transparent group-hover:border-blue-400/40'
                  }`}></div>
                </div>
              </div>

              {/* Futuristic Player Name */}
              <div className="w-full min-w-0 px-1 text-center sm:px-1.5">
                <h3 className="text-[11px] sm:text-sm lg:text-base font-medium leading-tight text-white/50 tracking-wide transition-colors duration-300 group-hover:text-white/70">
                  {player.firstName}
                </h3>
                <p className="mt-0.5 w-full max-w-full break-words text-[10px] font-bold normal-case leading-tight tracking-tight text-white transition-colors duration-300 sm:text-[11px] md:text-xs lg:text-sm group-hover:text-sky-100">
                  {formatKioskSurname(player.lastName)}
                </p>
                
                {/* Futuristic Status Text */}
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

              {/* Futuristic Hover Effect Overlay */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-cyan-500/0 group-hover:from-blue-500/10 group-hover:via-purple-500/5 group-hover:to-cyan-500/10 transition-all duration-500 pointer-events-none"></div>
              
              {/* Animated border effect */}
              <div className="absolute inset-0 rounded-3xl border-2 border-transparent group-hover:border-blue-400/20 transition-all duration-500 pointer-events-none"></div>
            </button>
          ))}
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-20">
            <div className={`relative ${activeTheme.emptyStateCard} backdrop-blur-xl rounded-3xl p-12 max-w-lg mx-auto shadow-2xl`}>
              <div className={`absolute inset-0 ${activeTheme.modalOverlay} rounded-3xl`}></div>
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-slate-500/80 to-slate-600/80 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl border-2 border-slate-600/50 backdrop-blur-sm">
                  <User className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-2xl font-light text-white mb-4 tracking-wide">No players found</h3>
                <div className="w-16 h-0.5 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full mx-auto mb-4"></div>
                <p className="text-base text-gray-300 tracking-wide">
                  {selectedLetter ? `No players found starting with "${selectedLetter}"` : 'No players available for this survey'}
                </p>
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
