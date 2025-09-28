'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Survey, Player, Response } from '@prisma/client'
import { CheckCircle, User, Home, Maximize, Minimize } from 'lucide-react'
import { validatePlayerPassword } from '@/lib/passwordUtils'

interface PlayerWithStatus extends Player {
  hasResponded: boolean
  responseId?: string
}

export default function KioskModePage({ params }: { params: Promise<{ surveyId: string }> }) {
  const router = useRouter()
  const { surveyId } = use(params)
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [players, setPlayers] = useState<PlayerWithStatus[]>([])
  const [selectedLetter, setSelectedLetter] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [adminPassword, setAdminPassword] = useState('')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [playerPassword, setPlayerPassword] = useState('')
  const [showPlayerPasswordModal, setShowPlayerPasswordModal] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithStatus | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        
        // Fetch survey details
        const surveyResponse = await fetch(`/api/surveys/${surveyId}`)
        if (surveyResponse.ok) {
          const surveyData = await surveyResponse.json()
          setSurvey(surveyData)
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

  const handlePlayerClick = async (player: PlayerWithStatus) => {
    setSelectedPlayer(player)
    setShowPlayerPasswordModal(true)
  }

  const handlePlayerPasswordSubmit = async () => {
    if (!selectedPlayer) return
    
    // Validate the password
    if (validatePlayerPassword(playerPassword, selectedPlayer.firstName, selectedPlayer.lastName)) {
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
          router.push(`/survey/${surveyId}?playerId=${selectedPlayer.id}`)
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
        router.push(`/survey/${surveyId}?playerId=${selectedPlayer.id}`)
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
    if (adminPassword === '123') {
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
  }, [])

  const getPlayersByLetter = (letter: string) => {
    if (!letter) return players
    return players.filter(player => 
      player.lastName.toUpperCase().startsWith(letter)
    )
  }

  const filteredPlayers = getPlayersByLetter(selectedLetter)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading players...</p>
        </div>
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Survey Not Found</h1>
          <p className="text-gray-300">The requested survey could not be found.</p>
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
      <div className={`${isFullscreen ? 'fixed inset-0' : 'min-h-screen'} bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 relative overflow-auto`}>
      {/* Futuristic Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-cyan-600/5"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent"></div>
      
      {/* Futuristic Header - Mobile Optimized */}
      <div className="relative bg-slate-800/60 backdrop-blur-xl border-b border-slate-700/50 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-cyan-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-6">
          {/* Mobile Layout */}
          <div className="block sm:hidden">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-light text-white tracking-wide drop-shadow-lg truncate flex-1 mr-2">
                {survey.title}
              </h1>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleHomeClick}
                  className="bg-slate-600/80 hover:bg-slate-500/80 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-1 text-xs font-semibold transition-all duration-300 backdrop-blur-sm border border-slate-600/50"
                  title="Home (Admin Access Required)"
                >
                  <Home className="h-3 w-3" />
                  <span>Admin</span>
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="bg-blue-600/80 hover:bg-blue-500/80 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-1 text-xs font-semibold transition-all duration-300 backdrop-blur-sm border border-blue-500/50"
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isFullscreen ? <Minimize className="h-3 w-3" /> : <Maximize className="h-3 w-3" />}
                  <span>{isFullscreen ? "Exit" : "Full"}</span>
                </button>
              </div>
            </div>
            <p className="text-gray-300 text-sm tracking-wide">Select your name to begin the survey</p>
          </div>
          
          {/* Desktop Layout */}
          <div className="hidden sm:block">
            <div className="flex items-center justify-between">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-cyan-600/20 blur-lg"></div>
                <h1 className="relative text-4xl font-light text-white tracking-wider drop-shadow-lg">
                  {survey.title}
                </h1>
                <div className="relative mt-2 w-32 h-0.5 bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 rounded-full"></div>
                <p className="relative mt-3 text-gray-300 text-base tracking-wide">Select your name to begin the survey</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={toggleFullscreen}
                  className="relative bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-500/80 hover:to-purple-500/80 text-white px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 text-sm font-semibold transition-all duration-300 transform hover:scale-105 backdrop-blur-sm border border-blue-500/50"
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  <span className="tracking-wide">{isFullscreen ? "Exit" : "Full"}</span>
                </button>
                <button
                  onClick={handleHomeClick}
                  className="relative bg-gradient-to-r from-slate-600/80 to-slate-700/80 hover:from-slate-500/80 hover:to-slate-600/80 text-white px-6 py-3 rounded-xl shadow-xl flex items-center space-x-3 text-base font-semibold transition-all duration-300 transform hover:scale-105 backdrop-blur-sm border border-slate-600/50"
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
          <div className="relative bg-slate-800/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-slate-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-cyan-600/10 rounded-2xl"></div>
            <div className="relative">
              <h3 className="text-2xl font-light text-white mb-2 tracking-wide">Admin Access Required</h3>
              <div className="w-16 h-0.5 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full mb-6"></div>
              <p className="text-base text-gray-300 mb-6 tracking-wide">Enter password to access admin dashboard:</p>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                className="w-full px-4 py-4 border border-slate-600/50 bg-slate-700/50 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 mb-6 backdrop-blur-sm text-base tracking-wide"
                placeholder="Enter password..."
                autoFocus
              />
              <div className="flex space-x-4">
                <button
                  onClick={handlePasswordSubmit}
                  className="flex-1 bg-gradient-to-r from-blue-500/80 to-cyan-500/80 hover:from-blue-400/80 hover:to-cyan-400/80 text-white px-6 py-3 rounded-xl text-base font-semibold transition-all duration-300 backdrop-blur-sm border border-blue-400/30"
                >
                  Access Admin
                </button>
                <button
                  onClick={handlePasswordCancel}
                  className="flex-1 bg-gradient-to-r from-slate-600/80 to-slate-700/80 hover:from-slate-500/80 hover:to-slate-600/80 text-white px-6 py-3 rounded-xl text-base font-semibold transition-all duration-300 backdrop-blur-sm border border-slate-600/50"
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
          <div className="relative bg-slate-800/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-slate-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-cyan-600/10 rounded-2xl"></div>
            <div className="relative">
              <h3 className="text-2xl font-light text-white mb-2 text-center tracking-wide">Player Authentication</h3>
              <div className="w-16 h-0.5 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full mx-auto mb-6"></div>
              <p className="text-base text-gray-300 mb-6 text-center tracking-wide">
                Enter password for <strong className="text-white">{selectedPlayer.firstName} {selectedPlayer.lastName}</strong>:
              </p>
              <input
                type="text"
                value={playerPassword}
                onChange={(e) => setPlayerPassword(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handlePlayerPasswordSubmit()}
                className="w-full px-3 py-2 sm:px-4 sm:py-4 border border-slate-600/50 bg-slate-700/50 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 mb-6 text-center text-lg sm:text-2xl font-mono tracking-widest backdrop-blur-sm"
                placeholder=""
                autoFocus
                maxLength={2}
              />
              <div className="flex space-x-4">
                <button
                  onClick={handlePlayerPasswordSubmit}
                  className="flex-1 bg-gradient-to-r from-blue-500/80 to-cyan-500/80 hover:from-blue-400/80 hover:to-cyan-400/80 text-white px-6 py-3 rounded-xl text-base font-semibold transition-all duration-300 backdrop-blur-sm border border-blue-400/30"
                >
                  Continue
                </button>
                <button
                  onClick={handlePlayerPasswordCancel}
                  className="flex-1 bg-gradient-to-r from-slate-600/80 to-slate-700/80 hover:from-slate-500/80 hover:to-slate-600/80 text-white px-6 py-3 rounded-xl text-base font-semibold transition-all duration-300 backdrop-blur-sm border border-slate-600/50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Futuristic Alphabet Navigation - Mobile Optimized */}
      <div className="relative bg-slate-800/60 backdrop-blur-xl border-b border-slate-700/30 py-4 sm:py-8">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-purple-600/5 to-cyan-600/5"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-2xl font-light text-white mb-2 sm:mb-3 tracking-wide">Filter by Last Name</h2>
            <div className="w-16 sm:w-20 h-0.5 bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 rounded-full mx-auto mb-2 sm:mb-3"></div>
            <p className="text-sm sm:text-base text-gray-300 tracking-wide">Click a letter to filter players</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
            <button
              onClick={() => setSelectedLetter('')}
              className={`px-3 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg backdrop-blur-sm border ${
                !selectedLetter 
                  ? 'bg-gradient-to-r from-blue-500/80 to-cyan-500/80 text-white shadow-xl border-blue-400/50' 
                  : 'bg-slate-700/50 text-gray-200 hover:bg-slate-600/50 border-slate-600/50 hover:border-blue-400/50'
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
                  className={`px-3 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg backdrop-blur-sm border ${
                    selectedLetter === letter
                      ? 'bg-gradient-to-r from-blue-500/80 to-cyan-500/80 text-white shadow-xl border-blue-400/50'
                      : hasPlayers
                      ? 'bg-slate-700/50 text-gray-200 hover:bg-slate-600/50 border-slate-600/50 hover:border-blue-400/50'
                      : 'bg-slate-600/30 text-gray-500 cursor-not-allowed border-slate-600/30'
                  }`}
                >
                  {letter}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Futuristic Players Grid */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/3 via-purple-600/3 to-cyan-600/3 rounded-3xl"></div>
        <div className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-8">
          {filteredPlayers.map((player) => (
            <div
              key={player.id}
              onClick={() => handlePlayerClick(player)}
              className={`group relative bg-slate-700/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl hover:shadow-3xl cursor-pointer transition-all duration-500 transform hover:scale-110 hover:-translate-y-2 p-3 sm:p-6 lg:p-8 border ${
                player.hasResponded 
                  ? 'ring-2 ring-green-400/60 bg-gradient-to-br from-green-900/30 to-slate-700/60 border-green-400/30' 
                  : 'hover:ring-2 hover:ring-blue-400/60 bg-gradient-to-br from-slate-700/60 to-blue-900/20 border-slate-600/30 hover:border-blue-400/30'
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
                    <img
                      src={player.image}
                      alt={`${player.firstName} ${player.lastName}`}
                      className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full object-cover border-2 sm:border-4 border-slate-600/50 shadow-2xl group-hover:border-blue-400/60 transition-all duration-500 backdrop-blur-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full bg-gradient-to-br from-slate-500/80 to-slate-600/80 border-2 sm:border-4 border-slate-600/50 shadow-2xl flex items-center justify-center group-hover:from-blue-400/80 group-hover:to-cyan-400/80 transition-all duration-500 backdrop-blur-sm">
                      <User className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-gray-300 group-hover:text-blue-300 transition-colors duration-500" />
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
              <div className="text-center">
                <h3 className="text-xs sm:text-base lg:text-lg font-semibold text-white leading-tight mb-1 sm:mb-2 group-hover:text-blue-300 transition-colors duration-500 tracking-wide">
                  {player.firstName}
                </h3>
                <p className="text-xs sm:text-sm lg:text-base font-medium text-gray-300 group-hover:text-blue-400 transition-colors duration-500 tracking-wide">
                  {player.lastName}
                </p>
                
                {/* Futuristic Status Text */}
                {player.hasResponded ? (
                  <div className="mt-3 inline-flex items-center px-2 py-1 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-semibold bg-green-900/40 text-green-300 border border-green-400/30 backdrop-blur-sm shadow-lg">
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Completed</span>
                    <span className="sm:hidden">Done</span>
                  </div>
                ) : (
                  <div className="mt-3 text-xs sm:text-sm text-gray-400 group-hover:text-blue-400 transition-colors duration-500 tracking-wide font-medium">
                    <span className="hidden sm:inline">Click to start</span>
                    <span className="sm:hidden">Start</span>
                  </div>
                )}
              </div>

              {/* Futuristic Hover Effect Overlay */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-cyan-500/0 group-hover:from-blue-500/10 group-hover:via-purple-500/5 group-hover:to-cyan-500/10 transition-all duration-500 pointer-events-none"></div>
              
              {/* Animated border effect */}
              <div className="absolute inset-0 rounded-3xl border-2 border-transparent group-hover:border-blue-400/20 transition-all duration-500 pointer-events-none"></div>
            </div>
          ))}
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-20">
            <div className="relative bg-slate-700/60 backdrop-blur-xl rounded-3xl p-12 max-w-lg mx-auto shadow-2xl border border-slate-600/50">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-cyan-600/10 rounded-3xl"></div>
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
      </div>
    </div>
    </>
  )
}
