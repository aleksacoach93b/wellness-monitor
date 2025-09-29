'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save } from 'lucide-react'
import { QuestionType } from '@prisma/client'
import HomeButton from '@/components/HomeButton'

interface Question {
  id: string
  text: string
  type: QuestionType
  options: string[]
  required: boolean
  order: number
}

export default function NewSurveyPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Recurring survey state
  const [isRecurring, setIsRecurring] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dailyStartTime, setDailyStartTime] = useState('06:00')
  const [dailyEndTime, setDailyEndTime] = useState('11:00')

  const addQuestion = () => {
    const newQuestion: Question = {
      id: `temp-${Date.now()}`,
      text: '',
      type: 'TEXT',
      options: [],
      required: true,
      order: questions.length
    }
    setQuestions([...questions, newQuestion])
  }

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => {
      if (q.id === id) {
        const updatedQuestion = { ...q, ...updates }
        
        // Initialize options for SLIDER type
        if (updates.type === 'SLIDER' && (!updatedQuestion.options || updatedQuestion.options.length === 0)) {
          updatedQuestion.options = ['', '', ''] // Left, Center, Right labels
        }
        
        return updatedQuestion
      }
      return q
    }))
  }

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id))
  }

  const addOption = (questionId: string) => {
    updateQuestion(questionId, {
      options: [...questions.find(q => q.id === questionId)!.options, '']
    })
  }

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    const question = questions.find(q => q.id === questionId)!
    const newOptions = [...question.options]
    newOptions[optionIndex] = value
    updateQuestion(questionId, { options: newOptions })
  }

  const removeOption = (questionId: string, optionIndex: number) => {
    const question = questions.find(q => q.id === questionId)!
    const newOptions = question.options.filter((_, index) => index !== optionIndex)
    updateQuestion(questionId, { options: newOptions })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || questions.length === 0) return

    setIsSubmitting(true)
    try {
      const requestData = {
        title: title.trim(),
        description: description.trim(),
        questions: questions.map(q => ({
          text: q.text.trim(),
          type: q.type,
          options: q.type === 'SLIDER' && q.options.length === 3 
            ? JSON.stringify({
                left: q.options[0] || '',
                center: q.options[1] || '',
                right: q.options[2] || ''
              })
            : q.options.filter(opt => opt.trim()),
          required: q.required,
          order: q.order,
        })),
        // Recurring survey data
        isRecurring,
        startDate: isRecurring ? startDate : null,
        endDate: isRecurring ? endDate : null,
        dailyStartTime: isRecurring ? dailyStartTime : null,
        dailyEndTime: isRecurring ? dailyEndTime : null,
      }

      console.log('Creating survey with data:', requestData)

      const response = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })

      if (response.ok) {
        const survey = await response.json()
        router.push(`/admin/surveys/${survey.id}`)
      } else {
        console.error('Response not ok:', response.status, response.statusText)
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        
        try {
          const errorData = await response.json()
          console.error('Failed to create survey:', errorData)
          errorMessage = errorData.error || errorMessage
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
          const responseText = await response.text()
          console.error('Raw response:', responseText)
        }
        
        alert(`Failed to create survey: ${errorMessage}`)
      }
    } catch (error) {
      console.error('Error creating survey:', error)
      alert('Failed to create survey')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white">Create New Survey</h1>
              <p className="mt-2 text-gray-300">Build a wellness survey for your players</p>
            </div>
            <HomeButton />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-medium text-white mb-4">Survey Details</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-300">
                  Survey Title *
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="e.g., Weekly Wellness Check"
                  required
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-300">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Brief description of the survey purpose..."
                />
              </div>
              
              {/* Recurring Survey Options */}
              <div className="border-t border-gray-600 pt-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isRecurring"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-500 rounded bg-gray-600"
                  />
                  <label htmlFor="isRecurring" className="ml-2 block text-sm font-medium text-gray-300">
                    Recurring Survey (Daily Reset)
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Survey will automatically activate/deactivate based on daily schedule
                </p>
                
                {isRecurring && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="startDate" className="block text-sm font-medium text-gray-300">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        id="startDate"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required={isRecurring}
                      />
                    </div>
                    <div>
                      <label htmlFor="endDate" className="block text-sm font-medium text-gray-300">
                        End Date *
                      </label>
                      <input
                        type="date"
                        id="endDate"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required={isRecurring}
                      />
                    </div>
                    <div>
                      <label htmlFor="dailyStartTime" className="block text-sm font-medium text-gray-300">
                        Daily Start Time *
                      </label>
                      <input
                        type="time"
                        id="dailyStartTime"
                        value={dailyStartTime}
                        onChange={(e) => setDailyStartTime(e.target.value)}
                        className="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required={isRecurring}
                      />
                    </div>
                    <div>
                      <label htmlFor="dailyEndTime" className="block text-sm font-medium text-gray-300">
                        Daily End Time *
                      </label>
                      <input
                        type="time"
                        id="dailyEndTime"
                        value={dailyEndTime}
                        onChange={(e) => setDailyEndTime(e.target.value)}
                        className="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required={isRecurring}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white">Questions</h2>
              <button
                type="button"
                onClick={addQuestion}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-300 bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Question
              </button>
            </div>

            {questions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No questions added yet. Click &quot;Add Question&quot; to get started.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {questions.map((question, index) => (
                  <div key={question.id} className="border border-gray-600 rounded-lg p-4 bg-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-white">Question {index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeQuestion(question.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300">
                          Question Text *
                        </label>
                        <input
                          type="text"
                          value={question.text}
                          onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                          className="mt-1 block w-full bg-gray-600 border-gray-500 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Enter your question..."
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300">
                          Question Type
                        </label>
                        <select
                          value={question.type}
                          onChange={(e) => updateQuestion(question.id, { type: e.target.value as QuestionType })}
                          className="mt-1 block w-full bg-gray-600 border-gray-500 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                          <option value="TEXT">Text Input</option>
                          <option value="NUMBER">Number Input</option>
                          <option value="EMAIL">Email Input</option>
                          <option value="SELECT">Single Choice</option>
                          <option value="MULTIPLE_SELECT">Multiple Choice</option>
                          <option value="SCALE">Scale (1-10)</option>
                          <option value="RATING_SCALE">Rating Scale (1-10)</option>
                          <option value="RPE">RPE - Rating of Perceived Exertion (1-10)</option>
                          <option value="SLIDER">Slider</option>
                          <option value="BOOLEAN">Yes/No</option>
                          <option value="BODY_MAP">Body Map (Pain/Injury)</option>
                          <option value="TIME">Time (24h format)</option>
                        </select>
                      </div>


                      {(question.type === 'SELECT' || question.type === 'MULTIPLE_SELECT') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300">
                            Options
                          </label>
                          <div className="mt-2 space-y-2">
                            {question.options.map((option, optionIndex) => (
                              <div key={optionIndex} className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                                  className="flex-1 bg-gray-600 border-gray-500 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                  placeholder={`Option ${optionIndex + 1}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeOption(question.id, optionIndex)}
                                  className="text-red-400 hover:text-red-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addOption(question.id)}
                              className="text-sm text-blue-400 hover:text-blue-300"
                            >
                              + Add Option
                            </button>
                          </div>
                        </div>
                      )}

                      {question.type === 'SLIDER' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300">
                            Slider Labels (Optional)
                          </label>
                          <div className="mt-2 grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Left Label</label>
                              <input
                                type="text"
                                value={question.options[0] || ''}
                                onChange={(e) => updateOption(question.id, 0, e.target.value)}
                                className="w-full bg-gray-600 border-gray-500 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="Very Bad"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Center Label</label>
                              <input
                                type="text"
                                value={question.options[1] || ''}
                                onChange={(e) => updateOption(question.id, 1, e.target.value)}
                                className="w-full bg-gray-600 border-gray-500 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="Ok"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Right Label</label>
                              <input
                                type="text"
                                value={question.options[2] || ''}
                                onChange={(e) => updateOption(question.id, 2, e.target.value)}
                                className="w-full bg-gray-600 border-gray-500 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="Excellent"
                              />
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-gray-400">
                            Leave empty to use default color legend (Low, Fair, Good, High)
                          </p>
                        </div>
                      )}

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`required-${question.id}`}
                          checked={question.required}
                          onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-500 rounded bg-gray-600"
                        />
                        <label htmlFor={`required-${question.id}`} className="ml-2 block text-sm text-gray-300">
                          Required question
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || questions.length === 0}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Creating...' : 'Create Survey'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
