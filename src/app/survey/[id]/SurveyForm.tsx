'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { QuestionType, Survey, Question } from '@prisma/client'
import { CheckCircle, AlertCircle } from 'lucide-react'
import BodyMap from '@/components/BodyMap'

interface SurveyFormProps {
  survey: Survey & {
    questions: Question[]
  }
}

export default function SurveyForm({ survey }: SurveyFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<Record<string, string | string[]>>({})
  const [playerName, setPlayerName] = useState('')
  const [playerEmail, setPlayerEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [player, setPlayer] = useState<{firstName: string, lastName: string, email?: string} | null>(null)
  const [bodyMapView, setBodyMapView] = useState<'front' | 'back'>('front')
  const [painBodyMapData, setPainBodyMapData] = useState<Record<string, number>>({})
  const [sorenessBodyMapData, setSorenessBodyMapData] = useState<Record<string, number>>({})
  const [showBodyMap, setShowBodyMap] = useState(false)
  const [currentBodyMapMode, setCurrentBodyMapMode] = useState<'pain' | 'soreness'>('pain')

  // Check for playerId in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const playerIdParam = urlParams.get('playerId')
    if (playerIdParam) {
      setPlayerId(playerIdParam)
      fetchPlayer(playerIdParam)
    }
  }, [])

  const fetchPlayer = async (id: string) => {
    try {
      const response = await fetch(`/api/players/${id}`)
      if (response.ok) {
        const playerData = await response.json()
        setPlayer(playerData)
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
    if (currentBodyMapMode === 'pain') {
      setPainBodyMapData(prev => {
        if (rating === 0) {
          // Remove the area if rating is 0 (deselection)
          const newData = { ...prev }
          delete newData[areaId]
          return newData
        } else {
          // Add or update the area with the rating
          return {
            ...prev,
            [areaId]: rating
          }
        }
      })
    } else {
      setSorenessBodyMapData(prev => {
        if (rating === 0) {
          // Remove the area if rating is 0 (deselection)
          const newData = { ...prev }
          delete newData[areaId]
          return newData
        } else {
          // Add or update the area with the rating
          return {
            ...prev,
            [areaId]: rating
          }
        }
      })
    }
  }

  const isBodyMapQuestion = (questionText: string) => {
    return questionText.includes('muscles sore') || questionText.includes('pain in the muscles')
  }

  const getBodyMapMode = (questionText: string): 'pain' | 'soreness' => {
    // Determine mode based on question text
    if (questionText.includes('sore')) return 'soreness'
    if (questionText.includes('pain')) return 'pain'
    // Default to pain
    return 'pain'
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
            // Check if this is a muscle question and we have body map data
            const question = survey.questions.find(q => q.id === questionId)
            if (question && isBodyMapQuestion(question.text)) {
              const mode = getBodyMapMode(question.text)
              const bodyMapData = mode === 'pain' ? painBodyMapData : sorenessBodyMapData
              
              // If we have body map data, append it to the answer
              if (Object.keys(bodyMapData).length > 0) {
                return {
                  questionId,
                  value: JSON.stringify(bodyMapData)
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
      console.log('Pain body map data:', painBodyMapData)
      console.log('Soreness body map data:', sorenessBodyMapData)
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
          window.location.href = `/kiosk/${survey.id}`
          
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
    <div className="min-h-screen bg-white">
      <form onSubmit={handleSubmit} className="min-h-screen flex flex-col bg-white">
        {/* Player Name as Title */}
        {playerName && (
          <div className="text-center pt-8 pb-6 bg-white">
            <h2 className="text-3xl font-light text-gray-900 tracking-wide">{playerName}</h2>
          </div>
        )}

        <div className="flex-1 px-6 pb-6 bg-white">

          <div className="space-y-8">
            {survey.questions.map((question, index) => (
              <div key={question.id} className="border-b border-gray-200 pb-8">
                <label className="block text-lg font-light text-gray-800 mb-6 tracking-wide">
                  {index + 1}. {question.text}
                  {question.required && <span className="text-red-500 ml-1">*</span>}
                </label>

            {question.type === 'TEXT' && (
              <input
                type="text"
                value={formData[question.id] as string || ''}
                onChange={(e) => handleInputChange(question.id, e.target.value)}
                className="mt-1 block w-full bg-white border-gray-300 text-gray-900 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter your answer..."
                required={question.required}
              />
            )}

            {question.type === 'NUMBER' && (
              <input
                type="number"
                value={formData[question.id] as string || ''}
                onChange={(e) => handleInputChange(question.id, e.target.value)}
                className="mt-1 block w-full bg-white border-gray-300 text-gray-900 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter a number..."
                required={question.required}
              />
            )}

            {question.type === 'EMAIL' && (
              <input
                type="email"
                value={formData[question.id] as string || ''}
                onChange={(e) => handleInputChange(question.id, e.target.value)}
                className="mt-1 block w-full bg-white border-gray-300 text-gray-900 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter your email..."
                required={question.required}
              />
            )}

            {question.type === 'BOOLEAN' && (
              <div className="mt-6">
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-200/50 shadow-sm">
                  <div className="grid grid-cols-2 gap-3">
                    {['Yes', 'No'].map((option) => {
                      const isSelected = formData[question.id] === option
                      const isYes = option === 'Yes'
                      
                      return (
                        <label 
                          key={option} 
                          className={`relative flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all duration-300 transform hover:scale-102 ${
                            isSelected
                              ? isYes
                                ? 'bg-gradient-to-br from-red-500 to-red-600 border-red-500 text-white shadow-md shadow-red-200'
                                : 'bg-gradient-to-br from-green-500 to-green-600 border-green-500 text-white shadow-md shadow-green-200'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 shadow-sm hover:shadow-md'
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
                          
                          {/* Custom radio indicator */}
                          <div className={`w-4 h-4 rounded-full border-2 mr-2 transition-all duration-300 ${
                            isSelected
                              ? 'border-white bg-white'
                              : 'border-gray-400 bg-white'
                          }`}>
                            {isSelected && (
                              <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-0.5 ${
                                isYes ? 'bg-red-500' : 'bg-green-500'
                              }`}></div>
                            )}
                          </div>
                          
                          <span className={`font-medium text-base ${
                            isSelected ? 'text-white' : 'text-gray-700'
                          }`}>
                            {option}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  
                  {/* Selected value display */}
                  {formData[question.id] && (
                    <div className="mt-3 text-center">
                      <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                        formData[question.id] === 'Yes' 
                          ? 'bg-red-50 text-red-700' 
                          : 'bg-green-50 text-green-700'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          formData[question.id] === 'Yes' ? 'bg-red-500' : 'bg-green-500'
                        }`}></div>
                        <span>Selected: {formData[question.id]}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Body Map Section - Show only for muscle questions when Yes is selected */}
                {isBodyMapQuestion(question.text) && shouldShowBodyMap(question.id) && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentBodyMapMode(getBodyMapMode(question.text))
                        setShowBodyMap(true)
                      }}
                      className="w-full bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white font-medium py-3 px-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-102"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        <span>Open Body Map Assessment</span>
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {question.type === 'SCALE' && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                  <span>1 (Low)</span>
                  <span>10 (High)</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData[question.id] as string || '5'}
                  onChange={(e) => handleInputChange(question.id, e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  required={question.required}
                />
                <div className="text-center mt-2">
                  <span className="text-lg font-semibold text-blue-600">
                    {formData[question.id] || '5'}
                  </span>
                </div>
              </div>
            )}

            {(question.type as string) === 'RATING_SCALE' && (
              <div className="mt-6">
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-200/50 shadow-sm">
                  <div className="flex flex-col items-center space-y-4">
                    {/* First row: 1-5 */}
                    <div className="flex space-x-3">
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
                            className={`w-14 h-14 rounded-2xl font-bold transition-all duration-300 text-xl border-2 shadow-lg transform hover:scale-105 ${
                              isSelected
                                ? `${colorClasses} border-white shadow-xl scale-110 ring-4 ring-white/50`
                                : `bg-white text-gray-600 hover:bg-gray-50 border-gray-200 hover:border-gray-300 shadow-md hover:shadow-lg ${hoverClasses}`
                            }`}
                          >
                            {rating}
                          </button>
                        )
                      })}
                    </div>
                    
                    {/* Second row: 6-10 */}
                    <div className="flex space-x-3">
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
                            className={`w-14 h-14 rounded-2xl font-bold transition-all duration-300 text-xl border-2 shadow-lg transform hover:scale-105 ${
                              isSelected
                                ? `${colorClasses} border-white shadow-xl scale-110 ring-4 ring-white/50`
                                : `bg-white text-gray-600 hover:bg-gray-50 border-gray-200 hover:border-gray-300 shadow-md hover:shadow-lg ${hoverClasses}`
                            }`}
                          >
                            {rating}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* Enhanced labels with icons */}
                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200/50">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-400 to-red-500"></div>
                      <span className="font-medium">Poor</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span className="font-medium">Excellent</span>
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-green-500"></div>
                    </div>
                  </div>
                  
                  {/* Selected value display */}
                  {formData[question.id] && (
                    <div className="mt-4 text-center">
                      <div className="inline-flex items-center px-4 py-2 bg-blue-50 rounded-full">
                        <span className="text-sm font-medium text-blue-800">
                          Selected: {formData[question.id]}/10
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(question.type as string) === 'SLIDER' && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                  <span>0</span>
                  <span>100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData[question.id] as string || '50'}
                  onChange={(e) => handleInputChange(question.id, e.target.value)}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  required={question.required}
                />
                <div className="text-center mt-2">
                  <span className="text-lg font-semibold text-blue-600">
                    {formData[question.id] || '50'}%
                  </span>
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
                    <span className="ml-2 text-sm text-gray-900">{option}</span>
                  </label>
                ))}
              </div>
            )}
              </div>
            ))}
          </div>

          <div className="pt-8 pb-6 bg-white">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-4 px-6 border border-transparent rounded-xl shadow-lg text-lg font-light text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Survey'}
            </button>
          </div>
        </div>
      </form>
      
      {/* Fullscreen Body Map */}
      {showBodyMap && (
        <BodyMap
          view={bodyMapView}
          mode={currentBodyMapMode}
          onAreaClick={handleBodyMapClick}
          selectedAreas={currentBodyMapMode === 'pain' ? painBodyMapData : sorenessBodyMapData}
          onViewChange={setBodyMapView}
          onContinue={() => setShowBodyMap(false)}
          onClose={() => setShowBodyMap(false)}
        />
      )}
    </div>
  )
}
