'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, Eye, ChevronUp, ChevronDown, Clock } from 'lucide-react'
import { QuestionType, Survey, Question } from '@prisma/client'
import HomeButton from '@/components/HomeButton'

interface QuestionFormState {
  id: string
  text: string
  type: QuestionType
  options: string[]
  required: boolean
  order: number
  sliderLabels?: {
    left?: string
    center?: string
    right?: string
  }
}

export default function EditSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [survey, setSurvey] = useState<Survey & { questions: Question[] } | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<QuestionFormState[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const response = await fetch(`/api/surveys/${id}`)
        if (response.ok) {
          const surveyData = await response.json()
          setSurvey(surveyData)
          setTitle(surveyData.title)
          setDescription(surveyData.description || '')
          setQuestions((surveyData.questions || []).map((q: Question) => {
            let parsedOptions = []
            let sliderLabels = undefined
            
            if (q.options) {
              try {
                const parsed = JSON.parse(q.options)
                if (Array.isArray(parsed)) {
                  parsedOptions = parsed
                } else if (parsed && (parsed.left || parsed.center || parsed.right)) {
                  sliderLabels = parsed
                }
              } catch (e) {
                // If parsing fails, treat as empty
              }
            }
            
            return {
              ...q,
              options: parsedOptions,
              sliderLabels: sliderLabels
            }
          }))
        }
      } catch (error) {
        console.error('Error fetching survey:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSurvey()
  }, [id])

  const addQuestion = () => {
    const newQuestion: QuestionFormState = {
      id: `temp-${Date.now()}`,
      text: '',
      type: 'TEXT',
      options: [],
      required: true,
      order: questions.length
    }
    setQuestions([...questions, newQuestion])
  }

  const updateQuestion = (id: string, updates: Partial<QuestionFormState>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q))
  }

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id))
  }

  const moveQuestionUp = (index: number) => {
    if (index > 0) {
      const newQuestions = [...questions]
      const temp = newQuestions[index]
      newQuestions[index] = newQuestions[index - 1]
      newQuestions[index - 1] = temp
      
      // Update order numbers
      newQuestions.forEach((q, i) => {
        q.order = i
      })
      
      setQuestions(newQuestions)
    }
  }

  const moveQuestionDown = (index: number) => {
    if (index < questions.length - 1) {
      const newQuestions = [...questions]
      const temp = newQuestions[index]
      newQuestions[index] = newQuestions[index + 1]
      newQuestions[index + 1] = temp
      
      // Update order numbers
      newQuestions.forEach((q, i) => {
        q.order = i
      })
      
      setQuestions(newQuestions)
    }
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

  const updateSliderLabel = (questionId: string, labelType: 'left' | 'center' | 'right', value: string) => {
    const question = questions.find(q => q.id === questionId)!
    const currentLabels = question.sliderLabels || {}
    updateQuestion(questionId, {
      sliderLabels: {
        ...currentLabels,
        [labelType]: value
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Add the two generic body map questions
      const allQuestions = [
        ...questions.map((q, index) => ({
          id: q.id.startsWith('temp-') ? undefined : q.id, // Don't send temp IDs to backend
          text: q.text,
          type: q.type,
          options: q.options.length > 0 ? JSON.stringify(q.options) : 
                   (q.sliderLabels && (q.sliderLabels.left || q.sliderLabels.center || q.sliderLabels.right)) ? 
                   JSON.stringify(q.sliderLabels) : null,
          required: q.required,
          order: index // Ensure order is correct on submission
        }))
      ]

      const requestData = {
        title,
        description: description || null,
        questions: allQuestions
      }

      console.log('Submitting survey update:', requestData)

      const response = await fetch(`/api/surveys/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })

      if (response.ok) {
        router.push('/')
        router.refresh()
      } else {
        let errorMessage = 'Unknown error'
        try {
          const errorData = await response.json()
          console.error('Failed to update survey:', errorData)
          errorMessage = errorData.error || errorData.details || 'Unknown error'
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        alert(`Failed to update survey: ${errorMessage}`)
      }
    } catch (error) {
      console.error('Error updating survey:', error)
      alert('Failed to update survey. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="p-6">Loading...</div>
  }

  if (!survey) {
    return <div className="p-6">Survey not found</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Survey</h1>
        <div className="flex space-x-3">
          <HomeButton />
          <button
            type="button"
            onClick={() => router.push(`/admin/surveys/${id}/results`)}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Results
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Survey Title
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter survey title..."
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description (Optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter survey description..."
              />
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Questions</h2>
            <button
              type="button"
              onClick={addQuestion}
              className="flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </button>
          </div>

          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-medium text-gray-900">Question {index + 1}</h3>
                    <div className="flex flex-col space-y-1">
                      <button
                        type="button"
                        onClick={() => moveQuestionUp(index)}
                        disabled={index === 0}
                        className={`p-1 rounded ${
                          index === 0 
                            ? 'text-gray-300 cursor-not-allowed' 
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                        title="Move question up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestionDown(index)}
                        disabled={index === questions.length - 1}
                        className={`p-1 rounded ${
                          index === questions.length - 1 
                            ? 'text-gray-300 cursor-not-allowed' 
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                        title="Move question down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuestion(question.id)}
                    className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                    title="Delete question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Question Text
                    </label>
                    <input
                      type="text"
                      value={question.text}
                      onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter question text..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Question Type
                      </label>
                      <select
                        value={question.type}
                        onChange={(e) => updateQuestion(question.id, { type: e.target.value as QuestionType, options: [] })}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="TEXT">Text</option>
                        <option value="NUMBER">Number</option>
                        <option value="EMAIL">Email</option>
                        <option value="BOOLEAN">Yes/No</option>
                        <option value="SCALE">Scale (1-10)</option>
                          <option value="RATING_SCALE">Rating Scale (1-10)</option>
                          <option value="RPE">RPE - Rating of Perceived Exertion (1-10)</option>
                        <option value="SLIDER">Slider</option>
                        <option value="SELECT">Single Choice</option>
                        <option value="MULTIPLE_SELECT">Multiple Choice</option>
                        <option value="BODY_MAP">Body Map</option>
                        <option value="TIME">Time (24h format)</option>
                      </select>
                    </div>
                  </div>


                  <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`required-${question.id}`}
                        checked={question.required}
                        onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`required-${question.id}`} className="ml-2 block text-sm text-gray-900">
                        Required
                      </label>
                    </div>
                  </div>

                  {(question.type === 'SELECT' || question.type === 'MULTIPLE_SELECT') && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Options
                        </label>
                        <button
                          type="button"
                          onClick={() => addOption(question.id)}
                          className="text-sm text-blue-600 hover:text-blue-900"
                        >
                          + Add Option
                        </button>
                      </div>
                      <div className="space-y-2">
                        {question.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                              className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                              placeholder={`Option ${optionIndex + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => removeOption(question.id, optionIndex)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {question.type === 'SLIDER' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Slider Labels (Optional)
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Left Label</label>
                          <input
                            type="text"
                            value={question.sliderLabels?.left || ''}
                            onChange={(e) => updateSliderLabel(question.id, 'left', e.target.value)}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="e.g., Very Bad"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Center Label</label>
                          <input
                            type="text"
                            value={question.sliderLabels?.center || ''}
                            onChange={(e) => updateSliderLabel(question.id, 'center', e.target.value)}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="e.g., Ok"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Right Label</label>
                          <input
                            type="text"
                            value={question.sliderLabels?.right || ''}
                            onChange={(e) => updateSliderLabel(question.id, 'right', e.target.value)}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="e.g., Very Good"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty to use default color legend (Low, Fair, Good, High)
                      </p>
                    </div>
                  )}
                </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => router.push(`/admin/surveys/${id}`)}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => router.push(`/admin/surveys/${id}/edit-schedule`)}
            className="flex items-center px-4 py-2 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-white hover:bg-blue-50"
          >
            <Clock className="h-4 w-4 mr-2" />
            Edit Schedule
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Updating...' : 'Update Survey'}
          </button>
        </div>
      </form>
    </div>
  )
}
