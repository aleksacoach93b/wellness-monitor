'use client'

import { useState } from 'react'
import { Response, Answer, Question } from '@prisma/client'

interface ResultsTableProps {
  responses: (Response & {
    answers: (Answer & {
      question: Question
    })[]
  })[]
}

export default function ResultsTable({ responses }: ResultsTableProps) {
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null)

  const toggleExpanded = (responseId: string) => {
    setExpandedResponse(expandedResponse === responseId ? null : responseId)
  }

  if (responses.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No responses yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {responses.map((response) => (
        <div key={response.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div 
            className="flex justify-between items-center cursor-pointer"
            onClick={() => toggleExpanded(response.id)}
          >
            <div>
              <h3 className="font-medium text-gray-900">
                {response.playerName || 'Anonymous'}
              </h3>
              <p className="text-sm text-gray-500">
                {new Date(response.submittedAt).toLocaleString()}
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {expandedResponse === response.id ? '▼' : '▶'}
            </div>
          </div>
          
          {expandedResponse === response.id && (
            <div className="mt-4 space-y-4">
              {response.answers.map((answer) => {
                // Check if this is body map data (pain or soreness)
                if ((answer.questionId === 'pain-body-map' || answer.questionId === 'soreness-body-map') && answer.value.includes('{')) {
                  try {
                    const bodyMapData = JSON.parse(answer.value)
                    const isPain = answer.questionId === 'pain-body-map'
                    const borderColor = isPain ? 'border-red-500' : 'border-orange-500'
                    const title = isPain ? 'Body Pain Assessment' : 'Body Soreness Assessment'
                    
                    return (
                      <div key={answer.id} className={`border-l-4 ${borderColor} pl-4`}>
                        <h4 className="font-medium text-gray-900 mb-2">{title}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {Object.entries(bodyMapData).map(([area, rating]) => (
                            <div key={area} className="bg-gray-50 p-2 rounded text-sm">
                              <span className="font-medium capitalize">{area.replace(/-/g, ' ')}</span>
                              <span className={`ml-2 font-bold ${isPain ? 'text-red-600' : 'text-orange-600'}`}>{rating}/10</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  } catch (e) {
                    return (
                      <div key={answer.id} className="border-l-4 border-blue-500 pl-4">
                        <h4 className="font-medium text-gray-900">{answer.question.text}</h4>
                        <p className="text-gray-700">{answer.value}</p>
                      </div>
                    )
                  }
                }
                
                // Check if this is the old body map data format
                if (answer.question.text.includes('muscle') && answer.value.includes('{')) {
                  try {
                    const bodyMapData = JSON.parse(answer.value)
                    return (
                      <div key={answer.id} className="border-l-4 border-green-500 pl-4">
                        <h4 className="font-medium text-gray-900 mb-2">{answer.question.text}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {Object.entries(bodyMapData).map(([area, rating]) => (
                            <div key={area} className="bg-gray-50 p-2 rounded text-sm">
                              <span className="font-medium capitalize">{area.replace(/-/g, ' ')}</span>
                              <span className="ml-2 text-blue-600 font-bold">{rating}/10</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  } catch (e) {
                    return (
                      <div key={answer.id} className="border-l-4 border-blue-500 pl-4">
                        <h4 className="font-medium text-gray-900">{answer.question.text}</h4>
                        <p className="text-gray-700">{answer.value}</p>
                      </div>
                    )
                  }
                }
                
                return (
                  <div key={answer.id} className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-medium text-gray-900">{answer.question.text}</h4>
                    <p className="text-gray-700">{answer.value}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
