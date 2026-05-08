'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Survey, Question, Player } from '@prisma/client'
import { CheckCircle } from 'lucide-react'
import BodyMap from '@/components/BodyMap'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { parseSliderOptions } from '@/lib/sliderOptions'
import {
  getSurveyShellClasses,
  getSurveyUiTokens,
  resolveSurveyAppearanceTheme,
  surveyDraftStorageKey,
  surveyQuestionFingerprint,
} from '@/lib/surveyFormAppearance'

interface SurveyFormProps {
  survey: Survey & {
    questions: Question[]
  }
  player?: Player | null
  /** URL: ?surveyTheme=soft | high (default omitted) */
  surveyTheme?: string | null
  /** Stable player id from URL for autosave key (recommended) */
  draftPlayerId?: string | null
}

export default function SurveyForm({
  survey,
  player,
  surveyTheme,
  draftPlayerId,
}: SurveyFormProps) {
  const router = useRouter()
  const appearance = resolveSurveyAppearanceTheme(surveyTheme)
  const shell = getSurveyShellClasses(appearance)
  const tokens = getSurveyUiTokens(appearance)
  const [formData, setFormData] = useState<Record<string, string | string[]>>({})
  const [playerName, setPlayerName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerData, setPlayerData] = useState<{firstName: string, lastName: string, email?: string | null, image?: string | null} | null>(null)
  const [bodyMapData, setBodyMapData] = useState<Record<string, Record<string, number>>>({})
  const [showBodyMap, setShowBodyMap] = useState(false)
  const [currentBodyMapQuestionId, setCurrentBodyMapQuestionId] = useState<string | null>(null)
  const [bodyMapView, setBodyMapView] = useState<'front' | 'back'>('front')
  const [validationBanner, setValidationBanner] = useState<string | null>(null)

  const fingerprint = useMemo(
    () => surveyQuestionFingerprint(survey.questions.map((q) => q.id)),
    [survey.questions]
  )

  const draftStorageKey = useMemo(
    () => surveyDraftStorageKey(survey.id, draftPlayerId ?? undefined),
    [survey.id, draftPlayerId]
  )

  // Check for playerId in URL params or use player prop
  useEffect(() => {
    if (player) {
      // Use player prop if available
      setPlayerData(player)
      setPlayerName(`${player.firstName} ${player.lastName}`)
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

  // Restore in-progress answers (same survey + player, max 24h)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = sessionStorage.getItem(draftStorageKey)
      if (!raw) return
      const d = JSON.parse(raw) as {
        fingerprint?: string
        savedAt?: number
        formData?: Record<string, string | string[]>
        bodyMapData?: Record<string, Record<string, number>>
      }
      if (!d?.fingerprint || d.fingerprint !== fingerprint) return
      if (!d.savedAt || Date.now() - d.savedAt > 86400000) return
      if (d.formData && typeof d.formData === 'object') {
        setFormData((prev) => ({ ...prev, ...d.formData }))
      }
      if (d.bodyMapData && typeof d.bodyMapData === 'object') {
        setBodyMapData(d.bodyMapData)
      }
    } catch {
      /* ignore corrupted draft */
    }
  }, [draftStorageKey, fingerprint])

  // Default slider midpoint when value still missing after draft restore
  useEffect(() => {
    if (!survey?.questions?.length) return
    setFormData((prev) => {
      const next = { ...prev }
      let changed = false
      for (const question of survey.questions) {
        if (question.type === 'SLIDER' && next[question.id] === undefined) {
          next[question.id] = '5'
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [survey.questions])

  // Autosave draft (debounced)
  useEffect(() => {
    if (typeof window === 'undefined' || isSubmitted) return
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            fingerprint,
            savedAt: Date.now(),
            formData,
            bodyMapData,
          })
        )
      } catch {
        /* quota / private mode */
      }
    }, 720)
    return () => window.clearTimeout(t)
  }, [bodyMapData, draftStorageKey, fingerprint, formData, isSubmitted])

  const fetchPlayer = async (id: string) => {
    try {
      const response = await fetch(`/api/players/${id}`)
      if (response.ok) {
        const playerData = await response.json()
        setPlayerData(playerData)
        setPlayerName(`${playerData.firstName} ${playerData.lastName}`)
      }
    } catch (error) {
      console.error('Error fetching player:', error)
    }
  }

  const handleInputChange = (questionId: string, value: string | string[]) => {
    setValidationBanner(null)
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
      setValidationBanner('Please fill in all required questions.')
      const first = missingRequired[0]
      requestAnimationFrame(() => {
        const el = document.getElementById(`survey-q-${first.id}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        window.setTimeout(() => {
          const focusable = el?.querySelector<HTMLElement>(
            'input:not([type="hidden"]):not(.sr-only), select, textarea, button'
          )
          focusable?.focus({ preventScroll: true })
        }, 420)
      })
      return
    }

    setValidationBanner(null)

    setIsSubmitting(true)
    try {
      // One row per survey question so answers always align with current question IDs
      // (Object.entries(formData) can miss keys or include stale ids after survey edits).
      const answers = survey.questions.map((question) => {
        const value = formData[question.id]
        if (isBodyMapQuestion(question)) {
          const questionBodyMapData = bodyMapData[question.id] || {}
          if (Object.keys(questionBodyMapData).length > 0) {
            return {
              questionId: question.id,
              value: JSON.stringify(questionBodyMapData),
            }
          }
        }
        const v = Array.isArray(value) ? JSON.stringify(value) : String(value ?? '')
        return { questionId: question.id, value: v }
      })

      const submissionData = {
        surveyId: survey.id,
        playerId: playerId || null,
        playerName: playerName.trim() || null,
        playerEmail: null, // Remove email from submission
        answers,
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
        try {
          sessionStorage.removeItem(draftStorageKey)
        } catch {
          /* ignore */
        }
        // If accessed from kiosk mode, redirect back to kiosk immediately
        if (playerId) {
          console.log('Redirecting to kiosk:', `/kiosk/${survey.id}`)
          // Use window.location for more reliable redirect
          if (typeof window !== 'undefined') {
            window.location.href = `/kiosk/${survey.id}`
          }
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

        /* Premium thumb for gradient slider questions */
        input.slider-fancy[type="range"]::-webkit-slider-thumb {
          width: 30px;
          height: 30px;
          margin-top: 0;
          box-shadow:
            0 8px 28px rgba(0, 0, 0, 0.45),
            0 0 0 4px rgba(255, 255, 255, 0.95),
            inset 0 2px 6px rgba(255, 255, 255, 0.85);
        }
        input.slider-fancy[type="range"]::-moz-range-thumb {
          width: 30px;
          height: 30px;
          box-shadow:
            0 8px 28px rgba(0, 0, 0, 0.45),
            0 0 0 4px rgba(255, 255, 255, 0.95);
        }

        @keyframes surveyFormEnter {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .survey-form-enter {
          animation: surveyFormEnter 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .survey-form-enter {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
      <div className={`min-h-screen ${shell.root} w-full overflow-x-hidden overflow-y-auto fixed inset-0 z-50`}>
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            // If accessed from kiosk mode, redirect back to kiosk
            if (playerId) {
              if (typeof window !== 'undefined') {
                window.location.href = `/kiosk/${survey.id}`
              }
            } else {
              // For non-kiosk mode, go back to home page
              router.push('/')
            }
          }}
          className={`absolute top-4 left-4 z-[60] transition-colors rounded-full p-2 backdrop-blur-sm min-w-[44px] min-h-[44px] flex items-center justify-center ${tokens.closeButton}`}
          aria-label="Close survey"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="survey-form-enter opacity-0">
        <form onSubmit={handleSubmit} className="min-h-screen flex flex-col w-full">
        {/* Mobile-Optimized Player Name as Title with Image */}
        {playerName && (
          <div className="text-center pt-6 pb-4 px-4 relative">
            <div className={`absolute inset-0 ${tokens.headerBackdropBlur}`}></div>
            
            {/* Player Image */}
            {playerData?.image && (
              <div className="relative mb-4 flex justify-center">
                <div className="relative">
                  <Image 
                    src={playerData.image} 
                    alt={playerName}
                    width={96}
                    height={96}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white/20 shadow-2xl object-cover"
                  />
                  <div className={`absolute inset-0 rounded-full ${tokens.avatarPulse}`}></div>
                </div>
              </div>
            )}
            
            <h2 className="relative text-2xl sm:text-3xl font-light text-white tracking-wide drop-shadow-lg">
              {playerName}
            </h2>
            <div className={`relative mt-2 w-16 h-0.5 mx-auto rounded-full ${tokens.headerUnderline}`}></div>
          </div>
        )}

        {validationBanner ? (
          <div
            role="alert"
            className="mx-4 mt-2 mb-3 px-4 py-3 rounded-xl bg-red-500/18 border border-red-400/45 text-red-50 text-sm text-center shadow-lg backdrop-blur-md [font-family:var(--font-geist-sans)]"
          >
            {validationBanner}
          </div>
        ) : null}

        <div className="flex-1 px-3 sm:px-4 pb-4 relative w-full">

          <div className="space-y-3 sm:space-y-4 w-full">
            {survey.questions.map((question, index) => (
              <div
                key={question.id}
                id={`survey-q-${question.id}`}
                className={`relative ${shell.card} backdrop-blur-sm rounded-xl border transition-all duration-300 w-full scroll-mt-28 ${
                  question.type === 'BODY_MAP' ? 'p-6 sm:p-8' : 'p-3 sm:p-4'
                }`}>
                <div className="mb-3 sm:mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-gray-400 to-gray-500 rounded-md flex items-center justify-center shadow-lg flex-shrink-0">
                      <span className="text-white font-bold text-xs">{index + 1}</span>
                    </div>
                    <div className="flex-grow">
                      <label className={`block font-medium text-white leading-snug tracking-wide ${shell.questionTitle}`}>
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
                className={`w-full px-3 py-2.5 sm:py-3 text-white text-sm sm:text-base transition-all duration-300 backdrop-blur-sm placeholder-gray-400 touch-manipulation ${tokens.inputFieldBase} ${tokens.focusVisibleRing}`}
                placeholder="Enter your answer..."
                required={question.required}
              />
            )}

            {question.type === 'NUMBER' && (
              <input
                type="number"
                value={formData[question.id] as string || ''}
                onChange={(e) => handleInputChange(question.id, e.target.value)}
                className={`w-full px-3 py-2.5 sm:py-3 text-white text-sm sm:text-base transition-all duration-300 backdrop-blur-sm placeholder-gray-400 touch-manipulation ${tokens.inputFieldBase} ${tokens.focusVisibleRing}`}
                placeholder="Enter a number..."
                required={question.required}
              />
            )}

            {question.type === 'EMAIL' && (
              <input
                type="email"
                value={formData[question.id] as string || ''}
                onChange={(e) => handleInputChange(question.id, e.target.value)}
                className={`w-full px-3 py-2.5 sm:py-3 text-white text-sm sm:text-base transition-all duration-300 backdrop-blur-sm placeholder-gray-400 touch-manipulation ${tokens.inputFieldBase} ${tokens.focusVisibleRing}`}
                placeholder="Enter your email..."
                required={question.required}
              />
            )}

            {question.type === 'TIME' && (
              <div className="space-y-3">
                <p className={`text-sm ${tokens.hintText}`}>
                  Select the time. Pay attention to hour format.
                </p>
                <div className="flex items-center space-x-3">
                  <input
                    type="time"
                    value={formData[question.id] as string || ''}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    className={`flex-1 px-3 py-2.5 sm:py-3 text-white text-sm sm:text-base transition-all duration-300 backdrop-blur-sm touch-manipulation ${tokens.inputFieldBase} ${tokens.focusVisibleRing}`}
                    required={question.required}
                  />
                  <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${tokens.timeAddonButton}`}>
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
                    className={`relative flex items-center justify-center gap-2 min-h-[52px] min-w-[5.25rem] sm:min-w-0 px-4 py-3 sm:px-5 sm:py-3 rounded-xl border-2 cursor-pointer transition-all duration-300 backdrop-blur-sm ${
                      isSelected
                        ? isYes
                          ? 'bg-gradient-to-br from-red-500/80 to-red-600/80 border-red-400/60 text-white shadow-lg shadow-red-500/25'
                          : 'bg-gradient-to-br from-green-500/80 to-green-600/80 border-green-400/60 text-white shadow-lg shadow-green-500/25'
                        : tokens.booleanUnselected
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
                        className={`w-auto mx-auto block text-white font-medium py-2 px-4 sm:py-3 sm:px-6 transition-all duration-300 text-sm sm:text-base relative overflow-hidden group hover:scale-105 ${tokens.primaryCtaButton}`}
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
                <div className={`${tokens.nestedScaleCard}`}>
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
                            className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg font-bold transition-all duration-200 text-sm border-2 touch-manipulation ${tokens.scaleButtonFocusTail} ${
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
                            className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg font-bold transition-all duration-200 text-sm border-2 touch-manipulation ${tokens.scaleButtonFocusTail} ${
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
                      <div className={`inline-flex items-center px-3 py-1.5 ${tokens.selectedValuePill}`}>
                        <span className={`text-sm font-semibold ${tokens.selectedValueText}`}>
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
                <div className={`${tokens.nestedScaleCard}`}>
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
                            className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg font-bold transition-all duration-200 text-sm border-2 touch-manipulation ${tokens.scaleButtonFocusTail} ${
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
                            className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg font-bold transition-all duration-200 text-sm border-2 touch-manipulation ${tokens.scaleButtonFocusTail} ${
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
                      <div className={`inline-flex items-center px-3 py-1.5 ${tokens.selectedValuePill}`}>
                        <span className={`text-sm font-semibold ${tokens.selectedValueText}`}>
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
                <div className={`${tokens.nestedScaleCard}`}>
                  <div className="flex flex-col items-center space-y-3">
                    {/* First row: 1-5 */}
                    <div className="flex space-x-2">
                      {[1, 2, 3, 4, 5].map((rating) => {
                        // RPE colors - REVERSED from Rating Scale (1=green, 10=red)
                        let colorClasses = ''
                        if (rating >= 1 && rating <= 3) {
                          // Easy effort - GREEN
                          colorClasses = 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-green-200'
                        } else if (rating >= 4 && rating <= 6) {
                          // Moderate effort - YELLOW
                          colorClasses = 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-yellow-200'
                        } else if (rating >= 7 && rating <= 8) {
                          // Hard effort - ORANGE
                          colorClasses = 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-200'
                        } else if (rating >= 9 && rating <= 10) {
                          // Maximum effort - RED
                          colorClasses = 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200'
                        }

                        const isSelected = formData[question.id] === rating.toString()
                        
                        return (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => handleInputChange(question.id, rating.toString())}
                            className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg font-bold transition-all duration-200 text-sm border-2 touch-manipulation ${tokens.scaleButtonFocusTail} ${
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
                        if (rating >= 1 && rating <= 3) {
                          // Easy effort - GREEN
                          colorClasses = 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-green-200'
                        } else if (rating >= 4 && rating <= 6) {
                          // Moderate effort - YELLOW
                          colorClasses = 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-yellow-200'
                        } else if (rating >= 7 && rating <= 8) {
                          // Hard effort - ORANGE
                          colorClasses = 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-200'
                        } else if (rating >= 9 && rating <= 10) {
                          // Maximum effort - RED
                          colorClasses = 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200'
                        }

                        const isSelected = formData[question.id] === rating.toString()
                        
                        return (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => handleInputChange(question.id, rating.toString())}
                            className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg font-bold transition-all duration-200 text-sm border-2 touch-manipulation ${tokens.scaleButtonFocusTail} ${
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
                      <div className={`inline-flex items-center px-3 py-1.5 ${tokens.selectedValuePill}`}>
                        <span className={`text-sm font-semibold ${tokens.selectedValueText}`}>
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

        {(question.type as string) === 'SLIDER' && (() => {
          const sliderParsed = parseSliderOptions(question.options)
          const sliderVal = String(formData[question.id] ?? '5')
          const stepCaption = sliderParsed?.steps?.[sliderVal]?.trim()
          const showTriFooter =
            !!(sliderParsed?.left?.trim() || sliderParsed?.center?.trim() || sliderParsed?.right?.trim())
          const showDefaultLegend =
            !sliderParsed ||
            (!sliderParsed.left?.trim() &&
              !sliderParsed.center?.trim() &&
              !sliderParsed.right?.trim())

          return (
          <div className="mt-6">
            <div className={`${tokens.sliderCardBorder} backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)] relative overflow-hidden`}>
              <div className={`absolute inset-0 ${tokens.sliderGlowOverlay} pointer-events-none`} />
              <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none ${tokens.sliderGlowBlobTop}`} />
              <div className="absolute -bottom-20 -left-16 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
              
              <div className="relative mb-6 sm:mb-8">
                <div className="absolute top-1/2 left-0 right-0 h-3.5 sm:h-5 bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 rounded-full -translate-y-1/2 shadow-inner shadow-black/20 ring-1 ring-white/10" />
                <div className="absolute top-1/2 left-0 right-0 h-3.5 sm:h-5 -translate-y-1/2 rounded-full bg-gradient-to-r from-white/15 via-transparent to-white/10 pointer-events-none" />
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData[question.id] as string || '5'}
                  onChange={(e) => handleInputChange(question.id, e.target.value)}
                  className="slider-fancy w-full h-8 sm:h-10 bg-transparent appearance-none cursor-pointer relative z-10 transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    background: 'transparent',
                    outline: 'none'
                  }}
                  required={question.required}
                />
              </div>
              
              <div className="text-center mb-5 sm:mb-6 relative z-10">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 mb-3 [font-family:var(--font-outfit)]">
                  Your selection
                </p>
                <div className="relative inline-flex flex-col items-center gap-1">
                  <div
                    className="relative inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 md:w-[4.25rem] md:h-[4.25rem] rounded-2xl text-white shadow-[0_12px_40px_-8px_rgba(0,0,0,0.55)] transition-all duration-500 border border-white/25 [font-family:var(--font-outfit)]"
                    style={{
                      background: (() => {
                        const value = parseInt(formData[question.id] as string || '5', 10)
                        if (value <= 3) return 'linear-gradient(145deg, #f87171 0%, #dc2626 55%, #b91c1c 100%)'
                        if (value <= 5) return 'linear-gradient(145deg, #fb923c 0%, #ea580c 50%, #c2410c 100%)'
                        if (value <= 7) return 'linear-gradient(145deg, #facc15 0%, #ca8a04 50%, #a16207 100%)'
                        return 'linear-gradient(145deg, #4ade80 0%, #22c55e 45%, #15803d 100%)'
                      })()
                    }}
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    <span className="text-2xl sm:text-3xl md:text-[2rem] font-semibold relative z-10 tabular-nums tracking-tight drop-shadow-md">
                      {formData[question.id] || '5'}
                    </span>
                  </div>
                  {stepCaption ? (
                    <p
                      className="mt-4 max-w-[20rem] sm:max-w-md mx-auto text-center text-base sm:text-lg md:text-xl font-medium text-white/[0.95] leading-snug px-2 tracking-normal [font-family:var(--font-outfit)] drop-shadow-[0_2px_14px_rgba(0,0,0,0.4)] selection:bg-white/20"
                    >
                      {stepCaption}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500 italic [font-family:var(--font-outfit)] tracking-wide hidden sm:block">
                      Drag to rate from 1 to 10
                    </p>
                  )}
                </div>
              </div>
              
              {showTriFooter && sliderParsed ? (
                      <div className="flex justify-between items-start gap-2 mt-6 pt-5 border-t border-slate-600/35 relative z-10">
                        <span className="text-[11px] sm:text-xs text-slate-400 text-center flex-1 font-medium uppercase tracking-[0.18em] leading-relaxed [font-family:var(--font-outfit)]">
                          {sliderParsed.left?.trim() || 'Low'}
                        </span>
                        <span className="text-[11px] sm:text-xs text-slate-300 text-center flex-1 font-semibold uppercase tracking-[0.22em] leading-relaxed [font-family:var(--font-outfit)]">
                          {sliderParsed.center?.trim() || 'Fair'}
                        </span>
                        <span className="text-[11px] sm:text-xs text-slate-400 text-center flex-1 font-medium uppercase tracking-[0.18em] leading-relaxed [font-family:var(--font-outfit)]">
                          {sliderParsed.right?.trim() || 'High'}
                        </span>
                      </div>
              ) : null}
              
              {showDefaultLegend ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs text-slate-300 relative z-10 mt-2 [font-family:var(--font-outfit)]">
                  <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-700/35 px-2 sm:px-3 py-2 rounded-xl backdrop-blur-sm border border-slate-600/40">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-400 shadow-lg shrink-0" />
                    <span className="font-medium text-[11px] sm:text-xs tracking-wide text-slate-200">Low (1–3)</span>
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-700/35 px-2 sm:px-3 py-2 rounded-xl backdrop-blur-sm border border-slate-600/40">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-orange-400 shadow-lg shrink-0" />
                    <span className="font-medium text-[11px] sm:text-xs tracking-wide text-slate-200">Fair (4–5)</span>
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-700/35 px-2 sm:px-3 py-2 rounded-xl backdrop-blur-sm border border-slate-600/40">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-400 shadow-lg shrink-0" />
                    <span className="font-medium text-[11px] sm:text-xs tracking-wide text-slate-200">Good (6–7)</span>
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-700/35 px-2 sm:px-3 py-2 rounded-xl backdrop-blur-sm border border-slate-600/40">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-400 shadow-lg shrink-0" />
                    <span className="font-medium text-[11px] sm:text-xs tracking-wide text-slate-200">High (8–10)</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          )
        })()}


            {(question.type === 'SELECT' || question.type === 'MULTIPLE_SELECT') && question.options && (
              <div className="mt-2 space-y-2">
                {JSON.parse(question.options).map((option: string, optionIndex: number) => (
                  <label
                    key={optionIndex}
                    className={`flex items-center gap-3 min-h-[52px] px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${tokens.selectChoiceRow}`}
                  >
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
                      className={`h-5 w-5 shrink-0 ${tokens.selectControl}`}
                      required={question.required && question.type === 'SELECT'}
                    />
                    <span className="text-sm sm:text-base text-white leading-snug flex-1">{option}</span>
                  </label>
                ))}
              </div>
            )}
              </div>
            ))}
          </div>

        <div className="pt-4 px-2 sm:px-3 relative shrink-0 max-md:pb-[max(7rem,calc(5rem+env(safe-area-inset-bottom,0px)))] md:pb-6">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent"></div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`relative w-auto max-w-xs mx-auto flex justify-center py-3 px-6 min-h-[48px] border border-transparent rounded-xl shadow-2xl text-base font-bold text-white bg-gradient-to-r from-green-500/90 to-emerald-500/90 hover:from-green-400 hover:to-emerald-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-400/60 focus-visible:ring-offset-2 ${tokens.submitRingOffsetClass} disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-500 backdrop-blur-xl border border-green-400/50 touch-manipulation group hover:scale-105 overflow-hidden`}
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
      </div>
      
      {/* Body Map - Full Screen Flip using Portal */}
      {showBodyMap && currentBodyMapQuestionId && typeof window !== 'undefined' && 
        createPortal(
          <BodyMap
            view={bodyMapView}
            onAreaClick={handleBodyMapClick}
            selectedAreas={bodyMapData[currentBodyMapQuestionId] || {}}
            onViewChange={setBodyMapView}
            appearanceTheme={appearance}
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
