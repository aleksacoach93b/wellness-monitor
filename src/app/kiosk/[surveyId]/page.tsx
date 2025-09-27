'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Survey, Player, Response } from '@prisma/client'
import { CheckCircle, User, Home } from 'lucide-react'
import { validatePlayerPassword } from '@/lib/passwordUtils'

interface PlayerWithStatus extends Player {
  hasResponded: boolean
  responseId?: string
}

export default function KioskModePage({ params }: { params: Promise<{ surveyId: string }> }) {
  const router = useRouter()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [players, setPlayers] = useState<PlayerWithStatus[]>([])
  const [selectedLetter, setSelectedLetter] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [adminPassword, setAdminPassword] = useState('')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [playerPassword, setPlayerPassword] = useState('')
  const [showPlayerPasswordModal, setShowPlayerPasswordModal] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithStatus | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { surveyId } = await params
        
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
  }, [params])

  const handlePlayerClick = async (player: PlayerWithStatus) => {
    setSelectedPlayer(player)
    setShowPlayerPasswordModal(true)
  }

  const handlePlayerPasswordSubmit = async () => {
    if (!selectedPlayer) return
    
    const { surveyId } = await params
    
    // Validate the password
    if (validatePlayerPassword(playerPassword, selectedPlayer.firstName, selectedPlayer.lastName)) {
      if (selectedPlayer.hasResponded) {
        // If already responded, show a message or allow re-submission
        if (confirm(`${selectedPlayer.firstName} ${selectedPlayer.lastName} has already submitted this survey. Do you want to submit again?`)) {
          router.push(`/survey/${surveyId}?playerId=${selectedPlayer.id}`)
        }
      } else {
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

  const getPlayersByLetter = (letter: string) => {
    if (!letter) return players
    return players.filter(player => 
      player.lastName.toUpperCase().startsWith(letter)
    )
  }

  const filteredPlayers = getPlayersByLetter(selectedLetter)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading players...</p>
        </div>
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Survey Not Found</h1>
          <p className="text-gray-600">The requested survey could not be found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{survey.title}</h1>
              <p className="text-gray-600 text-sm">Select your name to begin the survey</p>
            </div>
            <button
              onClick={handleHomeClick}
              className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 text-sm font-medium transition-all duration-200 transform hover:scale-105"
              title="Home (Admin Access Required)"
            >
              <Home className="h-4 w-4" />
              <span>Admin</span>
            </button>
          </div>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Access Required</h3>
            <p className="text-sm text-gray-600 mb-4">Enter password to access admin dashboard:</p>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              placeholder="Enter password..."
              autoFocus
            />
            <div className="flex space-x-3">
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Access Admin
              </button>
              <button
                onClick={handlePasswordCancel}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Password Modal */}
      {showPlayerPasswordModal && selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Player Authentication</h3>
            <p className="text-sm text-gray-600 mb-2">
              Enter password for <strong>{selectedPlayer.firstName} {selectedPlayer.lastName}</strong>:
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Password format: First letter of first name + First letter of last name (e.g., "AB" for Aleksa Boskovic)
            </p>
            <input
              type="text"
              value={playerPassword}
              onChange={(e) => setPlayerPassword(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handlePlayerPasswordSubmit()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-center text-lg font-mono tracking-widest"
              placeholder="Enter initials..."
              autoFocus
              maxLength={2}
            />
            <div className="flex space-x-3">
              <button
                onClick={handlePlayerPasswordSubmit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Continue
              </button>
              <button
                onClick={handlePlayerPasswordCancel}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Alphabet Navigation */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-gray-200/30 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Filter by Last Name</h2>
            <p className="text-sm text-gray-600">Click a letter to filter players</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setSelectedLetter('')}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 shadow-sm ${
                !selectedLetter 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
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
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 shadow-sm ${
                    selectedLetter === letter
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                      : hasPlayers
                      ? 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-100'
                  }`}
                >
                  {letter}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modern Players Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {filteredPlayers.map((player) => (
            <div
              key={player.id}
              onClick={() => handlePlayerClick(player)}
              className={`group relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl cursor-pointer transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 p-6 ${
                player.hasResponded 
                  ? 'ring-2 ring-green-400 bg-gradient-to-br from-green-50 to-white' 
                  : 'hover:ring-2 hover:ring-blue-400 bg-gradient-to-br from-white to-blue-50/30'
              }`}
            >
              {/* Status Badge */}
              {player.hasResponded && (
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
              )}

              {/* Player Photo */}
              <div className="flex justify-center mb-4">
                <div className="relative">
                  {player.image ? (
                    <img
                      src={player.image}
                      alt={`${player.firstName} ${player.lastName}`}
                      className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg group-hover:border-blue-200 transition-colors duration-300"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 border-4 border-white shadow-lg flex items-center justify-center group-hover:from-blue-100 group-hover:to-blue-200 transition-all duration-300">
                      <User className="w-10 h-10 text-gray-500 group-hover:text-blue-600 transition-colors duration-300" />
                    </div>
                  )}
                  
                  {/* Subtle glow effect */}
                  <div className={`absolute inset-0 rounded-full ${
                    player.hasResponded 
                      ? 'bg-green-400/20 group-hover:bg-green-400/30' 
                      : 'bg-blue-400/0 group-hover:bg-blue-400/20'
                  } transition-all duration-300`}></div>
                </div>
              </div>

              {/* Player Name */}
              <div className="text-center">
                <h3 className="text-sm font-semibold text-gray-900 leading-tight mb-1 group-hover:text-blue-900 transition-colors duration-300">
                  {player.firstName}
                </h3>
                <p className="text-sm font-medium text-gray-700 group-hover:text-blue-700 transition-colors duration-300">
                  {player.lastName}
                </p>
                
                {/* Status Text */}
                {player.hasResponded ? (
                  <div className="mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Completed
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-500 group-hover:text-blue-600 transition-colors duration-300">
                    Click to start
                  </div>
                )}
              </div>

              {/* Hover Effect Overlay */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/0 to-blue-600/0 group-hover:from-blue-500/5 group-hover:to-blue-600/10 transition-all duration-300 pointer-events-none"></div>
            </div>
          ))}
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-16">
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 max-w-md mx-auto shadow-lg">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No players found</h3>
              <p className="text-sm text-gray-600">
                {selectedLetter ? `No players found starting with "${selectedLetter}"` : 'No players available for this survey'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
