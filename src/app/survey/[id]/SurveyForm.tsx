'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { QuestionType, Survey, Question, Player } from '@prisma/client'
import { CheckCircle, AlertCircle } from 'lucide-react'
import BodyMap from '@/components/BodyMap'
import { createPortal } from 'react-dom'

interface SurveyFormProps {
  survey: Survey & {
    questions: Question[]
  }
  player?: Player | null
}

export default function SurveyForm({ survey, player }: SurveyFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<Record<string, string | string[]>>({})
  const [playerName, setPlayerName] = useState('')
  const [playerEmail, setPlayerEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerData, setPlayerData] = useState<{firstName: string, lastName: string, email?: string | null, image?: string | null} | null>(null)
  const [bodyMapData, setBodyMapData] = useState<Record<string, Record<string, number>>>({})
  const [showBodyMap, setShowBodyMap] = useState(false)
  const [currentBodyMapQuestionId, setCurrentBodyMapQuestionId] = useState<string | null>(null)
  const [bodyMapView, setBodyMapView] = useState<'front' | 'back'>('front')

  // Check for playerId in URL params or use player prop
  useEffect(() => {
    if (player) {
      // Use player prop if available
      setPlayerData(player)
      setPlayerName(`${player.firstName} ${player.lastName}`)
      setPlayerEmail(player.email || '')
      setPlayerId(player.id)
    } else {
      // Fallback to URL params
      const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
      const playerIdParam = urlParams.get('playerId')
      if (playerIdParam) {
        setPlayerId(playerIdParam)
        fetchPlayer(playerIdParam)
      }
    }

    // Automatically enter fullscreen for mobile devices
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      const enterFullscreen = async () => {
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
      enterFullscreen()
    }
  }, [player])

  // Initialize slider questions with default value of 5
  useEffect(() => {
    if (survey?.questions) {
      const initialFormData: Record<string, string | string[]> = {}
      
      survey.questions.forEach(question => {
        if (question.type === 'SLIDER' && !formData[question.id]) {
          initialFormData[question.id] = '5'
        }
      })
      
      if (Object.keys(initialFormData).length > 0) {
        setFormData(prev => ({ ...prev, ...initialFormData }))
      }
    }
  }, [survey?.questions])

  const fetchPlayer = async (id: string) => {
    try {
      const response = await fetch(`/api/players/${id}`)
      if (response.ok) {
        const playerData = await response.json()
        setPlayerData(playerData)
        setPlayerName(`${playerData.firstName} ${playerData.lastName}`)
        setPlayerEmail(playerData.email || '')
      }
    } catch (error) {
      console.error('Error fetching player:', error)
    }
  }

  const handleInputChange = (questionId: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [questionId]: value
    }))
  }


  const handleBodyMapClick = (areaId: string, rating: number) => {
    if (!currentBodyMapQuestionId) return
    
    setBodyMapData(prev => {
      const questionData = prev[currentBodyMapQuestionId] || {}
      
      if (rating === 0) {
        // Remove the area if rating is 0 (deselection)
        const newQuestionData = { ...questionData }
        delete newQuestionData[areaId]
        return {
          ...prev,
          [currentBodyMapQuestionId]: newQuestionData
        }
      } else {
        // Add or update the area with the rating
        return {
          ...prev,
          [currentBodyMapQuestionId]: {
            ...questionData,
            [areaId]: rating
          }
        }
      }
    })
  }

  const isBodyMapQuestion = (question: Question) => {
    return question.type === 'BODY_MAP'
  }


  const shouldShowBodyMap = (questionId: string) => {
    return formData[questionId] === 'Yes'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required questions
    const requiredQuestions = survey.questions.filter(q => q.required)
    const missingRequired = requiredQuestions.filter(q => !formData[q.id] || 
      (Array.isArray(formData[q.id]) && formData[q.id].length === 0) ||
      (typeof formData[q.id] === 'string' && !(formData[q.id] as string).trim())
    )

    if (missingRequired.length > 0) {
      alert('Please fill in all required questions.')
      return
    }

    setIsSubmitting(true)
    try {
      const submissionData = {
        surveyId: survey.id,
        playerId: playerId || null,
        playerName: playerName.trim() || null,
        playerEmail: null, // Remove email from submission
        answers: [
          ...Object.entries(formData).map(([questionId, value]) => {
            // Check if this is a body map question and we have body map data
            const question = survey.questions.find(q => q.id === questionId)
            if (question && isBodyMapQuestion(question)) {
              const questionBodyMapData = bodyMapData[questionId] || {}
              
              // If we have body map data, append it to the answer
              if (Object.keys(questionBodyMapData).length > 0) {
                return {
                  questionId,
                  value: JSON.stringify(questionBodyMapData)
                }
              }
            }
            
            return {
              questionId,
              value: Array.isArray(value) ? JSON.stringify(value) : value
            }
          })
        ]
      }
      
      console.log('Submitting survey data:', submissionData)
      console.log('Body map data:', bodyMapData)
      console.log('Form data:', formData)
      
      const response = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData)
      })

      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)
      
      if (response.ok) {
        console.log('Survey submitted successfully, playerId:', playerId)
        // If accessed from kiosk mode, redirect back to kiosk immediately
        if (playerId) {
          console.log('Redirecting to kiosk:', `/kiosk/${survey.id}`)
          // Use window.location for more reliable redirect
          if (typeof window !== 'undefined') {
            window.location.href = `/kiosk/${survey.id}`
          }
          
          // Fallback: if redirect doesn't work within 3 seconds, show success message
          setTimeout(() => {
            console.log('Redirect fallback triggered')
            setIsSubmitted(true)
          }, 3000)
        } else {
          console.log('Setting submitted state for non-kiosk mode')
          setIsSubmitted(true)
        }
      } else {
        const errorData = await response.json()
        console.error('Survey submission failed:', errorData)
        console.error('Response status:', response.status)
        console.error('Response headers:', response.headers)
        
        let errorMessage = 'Unknown error'
        if (errorData.error) {
          errorMessage = errorData.error
        } else if (errorData.details) {
          errorMessage = `Validation error: ${JSON.stringify(errorData.details)}`
        } else {
          errorMessage = `HTTP ${response.status}: ${JSON.stringify(errorData)}`
        }
        
        alert(`Failed to submit survey: ${errorMessage}`)
      }
    } catch (error) {
      console.error('Error submitting survey:', error)
      alert('Failed to submit survey. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Thank you!</h2>
        <p className="text-gray-600">Your responses have been submitted successfully.</p>
      </div>
    )
  }

  return (
    <>
      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
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
        
        /* Mobile-Optimized Custom Thumb */
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffffff, #f8fafc);
          border: 3px solid #ffffff;
          cursor: pointer;
          box-shadow: 
            0 6px 20px rgba(0, 0, 0, 0.4), 
            0 0 0 3px rgba(255, 255, 255, 0.4),
            0 0 20px rgba(255, 255, 255, 0.3);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          margin-top: 2px;
          position: relative;
        }
        
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 
            0 8px 25px rgba(0, 0, 0, 0.5), 
            0 0 0 4px rgba(255, 255, 255, 0.6),
            0 0 30px rgba(255, 255, 255, 0.5);
        }
        
        input[type="range"]::-webkit-slider-thumb:active {
          transform: scale(1.1);
          box-shadow: 
            0 4px 15px rgba(0, 0, 0, 0.6), 
            0 0 0 5px rgba(255, 255, 255, 0.8),
            0 0 40px rgba(255, 255, 255, 0.7);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffffff, #f8fafc);
          border: 3px solid #ffffff;
          cursor: pointer;
          box-shadow: 
            0 6px 20px rgba(0, 0, 0, 0.4), 
            0 0 0 3px rgba(255, 255, 255, 0.4),
            0 0 20px rgba(255, 255, 255, 0.3);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          margin-top: 2px;
        }
        
        input[type="range"]::-moz-range-thumb:hover {
          transform: scale(1.2);
          box-shadow: 
            0 8px 25px rgba(0, 0, 0, 0.5), 
            0 0 0 4px rgba(59, 130, 246, 0.6),
            0 0 30px rgba(59, 130, 246, 0.5);
        }
        
        input[type="range"]::-moz-range-thumb:active {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        
        /* Smooth focus states */
        input[type="range"]:focus {
          outline: none;
        }
        
        input[type="range"]:focus::-webkit-slider-thumb {
          box-shadow: 
            0 8px 25px rgba(0, 0, 0, 0.5), 
            0 0 0 4px rgba(59, 130, 246, 0.8),
            0 0 30px rgba(59, 130, 246, 0.6);
        }
        
        input[type="range"]:focus::-moz-range-thumb {
          box-shadow: 
            0 8px 25px rgba(0, 0, 0, 0.5), 
            0 0 0 4px rgba(59, 130, 246, 0.8),
            0 0 30px rgba(59, 130, 246, 0.6);
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 w-full overflow-x-hidden overflow-y-auto fixed inset-0 z-50">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700/50 rounded-full p-2 backdrop-blur-sm"
          data-title="Close survey"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <form onSubmit={handleSubmit} className="min-h-screen flex flex-col w-full">
        {/* Mobile-Optimized Player Name as Title with Image */}
        {playerName && (
          <div className="text-center pt-6 pb-4 px-4 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-cyan-600/20 blur-3xl"></div>
            
            {/* Player Image */}
            {playerData?.image && (
              <div className="relative mb-4 flex justify-center">
                <div className="relative">
                  <img 
                    src={playerData.image} 
                    alt={playerName}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white/20 shadow-2xl object-cover"
                  />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 animate-pulse"></div>
                </div>
              </div>
            )}
            
            <h2 className="relative text-2xl sm:text-3xl font-light text-white tracking-wide drop-shadow-lg">
              {playerName}
            </h2>
            <div className="relative mt-2 w-16 h-0.5 bg-gradient-to-r from-blue-400 to-cyan-400 mx-auto rounded-full"></div>
          </div>
        )}

        <div className="flex-1 px-3 sm:px-4 pb-4 relative w-full">

          <div className="space-y-3 sm:space-y-4 w-full">
            {survey.questions.map((question, index) => (
              <div key={question.id} className={`relative bg-gradient-to-br from-slate-800/80 to-gray-800/80 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/50 transition-all duration-300 w-full ${
                question.type === 'BODY_MAP' ? 'p-6 sm:p-8' : 'p-3 sm:p-4'
              }`}>
                <div className="mb-3 sm:mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-gray-400 to-gray-500 rounded-md flex items-center justify-center shadow-lg flex-shrink-0">
                      <span className="text-white font-bold text-xs">{index + 1}</span>
                    </div>
                    <div className="flex-grow">
                      <label className="block text-sm sm:text-base font-medium text-white leading-tight tracking-wide">
                        {question.text}
                        {question.required && <span className="text-red-400 ml-1 text-sm">*</span>}
                      </label>
                    </div>
                  </div>
                  <div className="w-6 sm:w-8 h-0.5 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full"></div>
                </div>

            {question.type === 'TEXT' && (
              <input
                type="text"
                value={formData[question.id] as string || ''}
                onChange={(e) => handleInputChange(question.id, e.target.value)}
                className="w-full px-3 py-2.5 sm:py-3 bg-slate-700/50 border border-slate-600/50 text-white rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 focus:bg-slate-600/50 transition-all duration-300 backdrop-blur-sm placeholder-gray-400 touch-manipulation"
                placeholder="Enter your answer..."
                required={question.required}
              />
            )}

            {question.type === 'NUMBER' && (
              <input
                type="number"
                value={formData[question.id] as string || ''}
                onChange={(e) => handleInputChange(question.id, e.target.value)}
                className="w-full px-3 py-2.5 sm:py-3 bg-slate-700/50 border border-slate-600/50 text-white rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 focus:bg-slate-600/50 transition-all duration-300 backdrop-blur-sm placeholder-gray-400 touch-manipulation"
                placeholder="Enter a number..."
                required={question.required}
              />
            )}

            {question.type === 'EMAIL' && (
              <input
                type="email"
                value={formData[question.id] as string || ''}
                onChange={(e) => handleInputChange(question.id, e.target.value)}
                className="w-full px-3 py-2.5 sm:py-3 bg-slate-700/50 border border-slate-600/50 text-white rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 focus:bg-slate-600/50 transition-all duration-300 backdrop-blur-sm placeholder-gray-400 touch-manipulation"
                placeholder="Enter your email..."
                required={question.required}
              />
            )}

            {question.type === 'TIME' && (
              <div className="space-y-3">
                <p className="text-sm text-blue-300">
                  Select the time. Pay attention to hour format.
                </p>
                <div className="flex items-center space-x-3">
                  <input
                    type="time"
                    value={formData[question.id] as string || ''}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    className="flex-1 px-3 py-2.5 sm:py-3 bg-slate-700/50 border border-slate-600/50 text-white rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 focus:bg-slate-600/50 transition-all duration-300 backdrop-blur-sm touch-manipulation"
                    required={question.required}
                  />
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

        {(question.type === 'BOOLEAN' || question.type === 'BODY_MAP') && (
          <div className={`${question.type === 'BODY_MAP' ? 'mt-4 sm:mt-6' : 'mt-3 sm:mt-4'}`}>
            <div className="flex justify-center gap-2 sm:gap-3">
              {['Yes', 'No'].map((option) => {
                const isSelected = formData[question.id] === option
                const isYes = option === 'Yes'
                
                return (
                  <label 
                    key={option} 
                    className={`relative flex items-center justify-center px-3 py-2 sm:px-4 sm:py-2 md:px-6 md:py-3 rounded-lg border-2 cursor-pointer transition-all duration-300 backdrop-blur-sm w-16 sm:w-20 md:w-auto ${
                      isSelected
                        ? isYes
                          ? 'bg-gradient-to-br from-red-500/80 to-red-600/80 border-red-400/60 text-white shadow-lg shadow-red-500/25'
                          : 'bg-gradient-to-br from-green-500/80 to-green-600/80 border-green-400/60 text-white shadow-lg shadow-green-500/25'
                        : 'bg-slate-700/50 border-slate-600/50 text-gray-200 hover:border-blue-400/50 hover:bg-slate-600/50'
                    }`}
                  >
                      <input
                        type="radio"
                        name={question.id}
                        value={option}
                        checked={isSelected}
                        onChange={(e) => handleInputChange(question.id, e.target.value)}
                        className="sr-only"
                        required={question.required}
                      />
                      
                      {/* Custom radio indicator - Mobile Optimized */}
                      <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 mr-1 sm:mr-2 transition-all duration-300 ${
                        isSelected
                          ? 'border-white bg-white shadow-lg'
                          : 'border-gray-400 bg-white/20'
                      }`}>
                      </div>
                      
                      <span className={`font-semibold text-xs sm:text-sm tracking-wide ${
                        isSelected ? 'text-white' : 'text-gray-200'
                      }`}>
                        {option}
                      </span>
                    </label>
                  )
                })}
              </div>
                  
                  
                  {/* Body Map Section - Show only for BODY_MAP questions when Yes is selected */}
                  {question.type === 'BODY_MAP' && shouldShowBodyMap(question.id) && (
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentBodyMapQuestionId(question.id)
                          setShowBodyMap(true)
                          // Request fullscreen for mobile devices
                          if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                            const element = document.documentElement
                            if (element.requestFullscreen) {
                              element.requestFullscreen()
                            } else if ((element as HTMLElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen) {
                              (element as HTMLElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen!()
                            } else if ((element as HTMLElement & { msRequestFullscreen?: () => void }).msRequestFullscreen) {
                              (element as HTMLElement & { msRequestFullscreen?: () => void }).msRequestFullscreen!()
                            }
                          }
                        }}
                        className="w-auto mx-auto block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 sm:py-3 sm:px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-sm sm:text-base relative overflow-hidden group hover:scale-105"
                      >
                        
                        <div className="flex items-center justify-center space-x-2 relative z-10">
                          <span className="tracking-wide drop-shadow-lg">Open Body Map Assessment</span>
                        </div>
                        
                      </button>
                    </div>
                  )}
              </div>
            )}

            {question.type === 'SCALE' && (
              <div className="mt-4">
                <div className="bg-gray-600 rounded-xl p-4 border border-gray-500">
                  <div className="flex flex-col items-center space-y-3">
                    {/* First row: 1-5 */}
                    <div className="flex space-x-2">
                      {[1, 2, 3, 4, 5].map((rating) => {
                        // Determine color based on rating with gradients
                        let colorClasses = ''
                        if (rating >= 1 && rating <= 3) {
                          colorClasses = 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200'
                        } else if (rating >= 4 && rating <= 6) {
                          colorClasses = 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-200'
                        } else if (rating >= 7 && rating <= 8) {
                          colorClasses = 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-yellow-200'
                        } else if (rating >= 9 && rating <= 10) {
                          colorClasses = 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-green-200'
                        }

                        const isSelected = formData[question.id] === rating.toString()
                        
                        return (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => handleInputChange(question.id, rating.toString())}
                            className={`w-10 h-10 rounded-lg font-bold transition-all duration-200 text-sm border-2 ${
                              isSelected
                                ? `${colorClasses} border-white shadow-lg scale-105`
                                : `bg-gray-500 text-gray-200 hover:bg-gray-400 border-gray-400 hover:border-gray-300 shadow-sm`
                            }`}
                          >
                            {rating}
                          </button>
                        )
                      })}
                    </div>
                    
                    {/* Second row: 6-10 */}
                    <div className="flex space-x-2">
                      {[6, 7, 8, 9, 10].map((rating) => {
                        // Determine color based on rating with gradients
                        let colorClasses = ''
                        if (rating >= 1 && rating <= 3) {
                          colorClasses = 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200'
                        } else if (rating >= 4 && rating <= 6) {
                          colorClasses = 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-200'
                        } else if (rating >= 7 && rating <= 8) {
                          colorClasses = 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-yellow-200'
                        } else if (rating >= 9 && rating <= 10) {
                          colorClasses = 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-green-200'
                        }

                        const isSelected = formData[question.id] === rating.toString()
                        
                        return (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => handleInputChange(question.id, rating.toString())}
                            className={`w-10 h-10 rounded-lg font-bold transition-all duration-200 text-sm border-2 ${
                              isSelected
                                ? `${colorClasses} border-white shadow-lg scale-105`
                                : `bg-gray-500 text-gray-200 hover:bg-gray-400 border-gray-400 hover:border-gray-300 shadow-sm`
                            }`}
                          >
                            {rating}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* Simple labels */}
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-500">
                    <span className="text-sm text-gray-300 font-medium">Poor</span>
                    <span className="text-sm text-gray-300 font-medium">Excellent</span>
                  </div>
                  
                  {/* Selected value display */}
                  {formData[question.id] && (
                    <div className="mt-3 text-center">
                      <div className="inline-flex items-center px-3 py-1.5 bg-blue-900/30 rounded-lg">
                        <span className="text-sm font-semibold text-blue-300">
                          Selected: {formData[question.id]}/10
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(question.type as string) === 'RATING_SCALE' && (
              <div className="mt-4">
                <div className="bg-gray-600 rounded-xl p-4 border border-gray-500">
                  <div className="flex flex-col items-center space-y-3">
                    {/* First row: 1-5 */}
                    <div className="flex space-x-2">
                      {[1, 2, 3, 4, 5].map((rating) => {
                        // Determine color based on rating with gradients
                        let colorClasses = ''
                        let hoverClasses = ''
                        if (rating >= 1 && rating <= 3) {
                          colorClasses = 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200'
                          hoverClasses = 'hover:from-red-600 hover:to-red-700'
                        } else if (rating >= 4 && rating <= 6) {
                          colorClasses = 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-200'
                          hoverClasses = 'hover:from-orange-600 hover:to-orange-700'
                        } else if (rating >= 7 && rating <= 8) {
                          colorClasses = 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-yellow-200'
                          hoverClasses = 'hover:from-yellow-500 hover:to-yellow-600'
                        } else if (rating >= 9 && rating <= 10) {
                          colorClasses = 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-green-200'
                          hoverClasses = 'hover:from-green-600 hover:to-green-700'
                        }

                        const isSelected = formData[question.id] === rating.toString()
                        
                        return (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => handleInputChange(question.id, rating.toString())}
                            className={`w-10 h-10 rounded-lg font-bold transition-all duration-200 text-sm border-2 ${
                              isSelected
                                ? `${colorClasses} border-white shadow-lg scale-105`
                                : `bg-gray-500 text-gray-200 hover:bg-gray-400 border-gray-400 hover:border-gray-300 shadow-sm`
                            }`}
                          >
                            {rating}
                          </button>
                        )
                      })}
                    </div>
                    
                    {/* Second row: 6-10 */}
                    <div className="flex space-x-2">
                      {[6, 7, 8, 9, 10].map((rating) => {
                        // Determine color based on rating with gradients
                        let colorClasses = ''
                        let hoverClasses = ''
                        if (rating >= 1 && rating <= 3) {
                          colorClasses = 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200'
                          hoverClasses = 'hover:from-red-600 hover:to-red-700'
                        } else if (rating >= 4 && rating <= 6) {
                          colorClasses = 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-200'
                          hoverClasses = 'hover:from-orange-600 hover:to-orange-700'
                        } else if (rating >= 7 && rating <= 8) {
                          colorClasses = 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-yellow-200'
                          hoverClasses = 'hover:from-yellow-500 hover:to-yellow-600'
                        } else if (rating >= 9 && rating <= 10) {
                          colorClasses = 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-green-200'
                          hoverClasses = 'hover:from-green-600 hover:to-green-700'
                        }

                        const isSelected = formData[question.id] === rating.toString()
                        
                        return (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => handleInputChange(question.id, rating.toString())}
                            className={`w-10 h-10 rounded-lg font-bold transition-all duration-200 text-sm border-2 ${
                              isSelected
                                ? `${colorClasses} border-white shadow-lg scale-105`
                                : `bg-gray-500 text-gray-200 hover:bg-gray-400 border-gray-400 hover:border-gray-300 shadow-sm`
                            }`}
                          >
                            {rating}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* Simple labels */}
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-500">
                    <span className="text-sm text-gray-300 font-medium">Poor</span>
                    <span className="text-sm text-gray-300 font-medium">Excellent</span>
                  </div>
                  
                  {/* Selected value display */}
                  {formData[question.id] && (
                    <div className="mt-3 text-center">
                      <div className="inline-flex items-center px-3 py-1.5 bg-blue-900/30 rounded-lg">
                        <span className="text-sm font-semibold text-blue-300">
                          Selected: {formData[question.id]}/10
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(question.type as string) === 'RPE' && (
              <div className="mt-4">
                <div className="bg-gray-600 rounded-xl p-4 border border-gray-500">
                  <div className="flex flex-col items-center space-y-3">
                    {/* First row: 1-5 */}
                    <div className="flex space-x-2">
                      {[1, 2, 3, 4, 5].map((rating) => {
                        // RPE colors - REVERSED from Rating Scale (1=green, 10=red)
                        let colorClasses = ''
                        let hoverClasses = ''
                        if (rating >= 1 && rating <= 3) {
                          // Easy effort - GREEN
                          colorClasses = 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-green-200'
                          hoverClasses = 'hover:from-green-600 hover:to-green-700'
                        } else if (rating >= 4 && rating <= 6) {
                          // Moderate effort - YELLOW
                          colorClasses = 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-yellow-200'
                          hoverClasses = 'hover:from-yellow-500 hover:to-yellow-600'
                        } else if (rating >= 7 && rating <= 8) {
                          // Hard effort - ORANGE
                          colorClasses = 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-200'
                          hoverClasses = 'hover:from-orange-600 hover:to-orange-700'
                        } else if (rating >= 9 && rating <= 10) {
                          // Maximum effort - RED
                          colorClasses = 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200'
                          hoverClasses = 'hover:from-red-600 hover:to-red-700'
                        }

                        const isSelected = formData[question.id] === rating.toString()
                        
                        return (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => handleInputChange(question.id, rating.toString())}
                            className={`w-10 h-10 rounded-lg font-bold transition-all duration-200 text-sm border-2 ${
                              isSelected
                                ? `${colorClasses} border-white shadow-lg scale-105`
                                : `bg-gray-500 text-gray-200 hover:bg-gray-400 border-gray-400 hover:border-gray-300 shadow-sm`
                            }`}
                          >
                            {rating}
                          </button>
                        )
                      })}
                    </div>
                    
                    {/* Second row: 6-10 */}
                    <div className="flex space-x-2">
                      {[6, 7, 8, 9, 10].map((rating) => {
                        // RPE colors - REVERSED from Rating Scale (1=green, 10=red)
                        let colorClasses = ''
                        let hoverClasses = ''
                        if (rating >= 1 && rating <= 3) {
                          // Easy effort - GREEN
                          colorClasses = 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-green-200'
                          hoverClasses = 'hover:from-green-600 hover:to-green-700'
                        } else if (rating >= 4 && rating <= 6) {
                          // Moderate effort - YELLOW
                          colorClasses = 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-yellow-200'
                          hoverClasses = 'hover:from-yellow-500 hover:to-yellow-600'
                        } else if (rating >= 7 && rating <= 8) {
                          // Hard effort - ORANGE
                          colorClasses = 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-200'
                          hoverClasses = 'hover:from-orange-600 hover:to-orange-700'
                        } else if (rating >= 9 && rating <= 10) {
                          // Maximum effort - RED
                          colorClasses = 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200'
                          hoverClasses = 'hover:from-red-600 hover:to-red-700'
                        }

                        const isSelected = formData[question.id] === rating.toString()
                        
                        return (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => handleInputChange(question.id, rating.toString())}
                            className={`w-10 h-10 rounded-lg font-bold transition-all duration-200 text-sm border-2 ${
                              isSelected
                                ? `${colorClasses} border-white shadow-lg scale-105`
                                : `bg-gray-500 text-gray-200 hover:bg-gray-400 border-gray-400 hover:border-gray-300 shadow-sm`
                            }`}
                          >
                            {rating}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* RPE-specific labels */}
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-500">
                    <span className="text-sm text-green-300 font-medium">Very Light</span>
                    <span className="text-sm text-red-300 font-medium">Maximal</span>
                  </div>
                  
                  {/* Selected value display with RPE description */}
                  {formData[question.id] && (
                    <div className="mt-3 text-center">
                      <div className="inline-flex items-center px-3 py-1.5 bg-blue-900/30 rounded-lg">
                        <span className="text-sm font-semibold text-blue-300">
                          RPE: {formData[question.id]}/10
                          {formData[question.id] === '1' && ' - Very Light'}
                          {formData[question.id] === '2' && ' - Light'}
                          {formData[question.id] === '3' && ' - Moderate'}
                          {formData[question.id] === '4' && ' - Somewhat Hard'}
                          {formData[question.id] === '5' && ' - Hard'}
                          {formData[question.id] === '6' && ' - Hard+'}
                          {formData[question.id] === '7' && ' - Very Hard'}
                          {formData[question.id] === '8' && ' - Very Hard+'}
                          {formData[question.id] === '9' && ' - Very Very Hard'}
                          {formData[question.id] === '10' && ' - Maximal'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

        {(question.type as string) === 'SLIDER' && (
          <div className="mt-6">
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-slate-600/30 shadow-2xl relative overflow-hidden">
              {/* Animated background pattern */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 animate-pulse"></div>
              
              
              {/* Enhanced Gradient Slider with smooth animations - Mobile Optimized */}
              <div className="relative mb-4 sm:mb-6">
                {/* Enhanced Gradient Background Track */}
                <div className="absolute top-1/2 left-0 right-0 h-4 sm:h-6 bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 to-green-500 rounded-full transform -translate-y-1/2 shadow-lg">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-400/20 via-orange-400/20 via-yellow-400/20 to-green-400/20 rounded-full animate-pulse"></div>
                </div>
                
                {/* Enhanced Slider Input with smooth transitions - Mobile Optimized */}
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData[question.id] as string || '5'}
                  onChange={(e) => handleInputChange(question.id, e.target.value)}
                  className="w-full h-6 sm:h-8 bg-transparent appearance-none cursor-pointer relative z-10 transition-all duration-200 hover:scale-105"
                  style={{
                    background: 'transparent',
                    outline: 'none'
                  }}
                  required={question.required}
                />
                
              </div>
              
              {/* Enhanced Value Display with smooth animations - Mobile Optimized */}
              <div className="text-center mb-4 sm:mb-6">
                <div 
                  className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full text-white font-bold text-sm sm:text-lg md:text-xl shadow-2xl transition-all duration-500 backdrop-blur-sm border-2 border-white/30 hover:scale-110 hover:shadow-3xl relative overflow-hidden"
                  style={{
                    background: (() => {
                      const value = parseInt(formData[question.id] as string || '5')
                      if (value <= 3) return 'linear-gradient(135deg, #ef4444, #dc2626)'
                      if (value <= 5) return 'linear-gradient(135deg, #f97316, #ea580c)'
                      if (value <= 7) return 'linear-gradient(135deg, #eab308, #ca8a04)'
                      return 'linear-gradient(135deg, #22c55e, #16a34a)'
                    })()
                  }}
                >
                  {/* Animated glow effect */}
                  <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
                  <span className="text-white font-bold relative z-10 drop-shadow-lg">
                    {formData[question.id] || '5'}
                  </span>
                </div>
              </div>
              
              {/* Custom Labels - if available in question options */}
              {question.options && (() => {
                try {
                  const labels = JSON.parse(question.options)
                  if (labels && (labels.left || labels.center || labels.right)) {
                    return (
                      <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-600/30 relative z-10">
                        <span className="text-sm text-slate-300 font-medium text-center flex-1">
                          {labels.left || 'Low'}
                        </span>
                        <span className="text-sm text-slate-300 font-medium text-center flex-1">
                          {labels.center || 'Fair'}
                        </span>
                        <span className="text-sm text-slate-300 font-medium text-center flex-1">
                          {labels.right || 'High'}
                        </span>
                      </div>
                    )
                  }
                } catch (e) {
                  // If parsing fails, fall back to default labels
                }
                return null
              })()}
              
              {/* Default Color Legend with glassmorphism - Mobile Optimized (fallback) */}
              {!question.options || (() => {
                try {
                  const labels = JSON.parse(question.options)
                  return !labels || (!labels.left && !labels.center && !labels.right)
                } catch (e) {
                  return true
                }
              })() && (
                <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs text-slate-300 relative z-10">
                  <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-700/30 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg backdrop-blur-sm border border-slate-600/30">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500 shadow-lg animate-pulse"></div>
                    <span className="font-medium text-xs sm:text-sm">Low (1-3)</span>
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-700/30 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg backdrop-blur-sm border border-slate-600/30">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-orange-500 shadow-lg animate-pulse"></div>
                    <span className="font-medium text-xs sm:text-sm">Fair (4-5)</span>
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-700/30 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg backdrop-blur-sm border border-slate-600/30">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500 shadow-lg animate-pulse"></div>
                    <span className="font-medium text-xs sm:text-sm">Good (6-7)</span>
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-700/30 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg backdrop-blur-sm border border-slate-600/30">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500 shadow-lg animate-pulse"></div>
                    <span className="font-medium text-xs sm:text-sm">High (8-10)</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}


            {(question.type === 'SELECT' || question.type === 'MULTIPLE_SELECT') && question.options && (
              <div className="mt-2 space-y-2">
                {JSON.parse(question.options).map((option: string, optionIndex: number) => (
                  <label key={optionIndex} className="flex items-center">
                    <input
                      type={question.type === 'MULTIPLE_SELECT' ? 'checkbox' : 'radio'}
                      name={question.type === 'SELECT' ? question.id : undefined}
                      value={option}
                      checked={
                        question.type === 'SELECT' 
                          ? formData[question.id] === option
                          : (formData[question.id] as string[] || []).includes(option)
                      }
                      onChange={(e) => {
                        if (question.type === 'SELECT') {
                          handleInputChange(question.id, e.target.value)
                        } else {
                          const currentValues = formData[question.id] as string[] || []
                          const newValues = e.target.checked
                            ? [...currentValues, option]
                            : currentValues.filter(v => v !== option)
                          handleInputChange(question.id, newValues)
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      required={question.required && question.type === 'SELECT'}
                    />
                    <span className="ml-2 text-sm text-white">{option}</span>
                  </label>
                ))}
              </div>
            )}
              </div>
            ))}
          </div>

        <div className="pt-4 pb-4 px-2 sm:px-3 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent"></div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="relative w-auto max-w-xs mx-auto flex justify-center py-3 px-6 border border-transparent rounded-xl shadow-2xl text-base font-bold text-white bg-gradient-to-r from-green-500/90 to-emerald-500/90 hover:from-green-400 hover:to-emerald-400 focus:outline-none focus:ring-4 focus:ring-green-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-500 backdrop-blur-xl border border-green-400/50 touch-manipulation group hover:scale-105 overflow-hidden"
          >
            {/* Animated background glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-300/20 to-emerald-300/20 rounded-xl animate-pulse group-hover:animate-none group-hover:from-green-300/30 group-hover:to-emerald-300/30"></div>
            
            <span className="relative z-10 drop-shadow-lg">
              {isSubmitting ? 'Submitting...' : 'Submit Survey'}
            </span>
            
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          </button>
        </div>
        </div>
      </form>
      
      {/* Body Map - Full Screen Flip using Portal */}
      {showBodyMap && currentBodyMapQuestionId && typeof window !== 'undefined' && 
        createPortal(
          <BodyMap
            view={bodyMapView}
            onAreaClick={handleBodyMapClick}
            selectedAreas={bodyMapData[currentBodyMapQuestionId] || {}}
            onViewChange={setBodyMapView}
            onContinue={() => {
              setShowBodyMap(false)
              setCurrentBodyMapQuestionId(null)
              // Exit fullscreen when closing body map
              if (typeof window !== 'undefined' && document.fullscreenElement) {
                if (document.exitFullscreen) {
                  document.exitFullscreen()
                } else if ((document as Document & { webkitExitFullscreen?: () => void }).webkitExitFullscreen) {
                  (document as Document & { webkitExitFullscreen?: () => void }).webkitExitFullscreen!()
                } else if ((document as Document & { msExitFullscreen?: () => void }).msExitFullscreen) {
                  (document as Document & { msExitFullscreen?: () => void }).msExitFullscreen!()
                }
              }
            }}
            onClose={() => {
              setShowBodyMap(false)
              setCurrentBodyMapQuestionId(null)
              // Exit fullscreen when closing body map
              if (typeof window !== 'undefined' && document.fullscreenElement) {
                if (document.exitFullscreen) {
                  document.exitFullscreen()
                } else if ((document as Document & { webkitExitFullscreen?: () => void }).webkitExitFullscreen) {
                  (document as Document & { webkitExitFullscreen?: () => void }).webkitExitFullscreen!()
                } else if ((document as Document & { msExitFullscreen?: () => void }).msExitFullscreen) {
                  (document as Document & { msExitFullscreen?: () => void }).msExitFullscreen!()
                }
              }
            }}
          />,
          document.body
        )
      }
      
      </div>
    </>
  )
}
