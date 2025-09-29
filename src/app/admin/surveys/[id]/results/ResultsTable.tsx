'use client'

import { useState } from 'react'
import { Response, Answer, Question } from '@prisma/client'
import { format } from 'date-fns'

// Muscle name mapping function (same as in BodyMap component)
const getMuscleName = (areaId: string): string => {
  const muscleNames: Record<string, string> = {
    // Front body paths
    'path-4': 'Face and Skin',
    'path-5': 'Top Head',
    'path-7': 'Right Pectoralis Major',
    'path-8': 'Right Intercostal',
    'path-9': 'Right Intercostal',
    'path-10': 'Right Intercostal',
    'path-11': 'Right Oblique',
    'path-12': 'Right Oblique',
    'path-13': 'Right Upper Rectus Abdominis',
    'path-14': 'Right Middle Rectus Abdominis',
    'path-15': 'Right Lower Rectus Abdominis',
    'path-16': 'Right Pubic Area',
    'path-17': 'Right Oblique',
    'path-18': 'Right Oblique',
    'path-19': 'Right Oblique',
    'path-20': 'Right Sternocleidomastoideus',
    'path-21': 'Right Trap Front',
    'path-22': 'Right Trapezius',
    'path-23': 'Right Deltoideus',
    'path-24': 'Right Biceps Brachii SH',
    'path-25': 'Right Biceps Brachii LH',
    'path-26': 'Right Forearm Lateral',
    'path-27': 'Right Forearm Central',
    'path-28': 'Right Forearm Medial',
    'path-29': 'Right Patella',
    'path-30': 'Right Medial Knee',
    'path-31': 'Right Calf Front',
    'path-32': 'Right Tibialis Anterior',
    'path-33': 'Right Digitorum Longus',
    'path-34': 'Right Ankle',
    'path-35': 'Right Ankle Ligaments',
    'path-36': 'Right Foot Front',
    'path-37': 'Right Feet Toe',
    'path-38': 'Right Hand Front',
    'path-39': 'Right 5th Finger',
    'path-40': 'Right 4th Finger',
    'path-41': 'Right 3rd Finger',
    'path-42': 'Right 2nd Finger',
    'path-43': 'Right 1st Finger',
    'path-44': 'Right Larynx',
    'path-45': 'Right Pubis Adductor',
    'path-46': 'Right Adductor Long',
    'path-47': 'Right Rectus Femoris',
    'path-48': 'Right Vastus Lateralis',
    'path-49': 'Right Vastus Medialis',
    'path-50': 'Right Adductor Short',
    'path-51': 'Left Pectoralis Major',
    'path-52': 'Left Intercostal',
    'path-53': 'Left Intercostal',
    'path-54': 'Left Intercostal',
    'path-55': 'Left Oblique',
    'path-56': 'Left Oblique',
    'path-57': 'Left Upper Rectus Abdominis',
    'path-58': 'Left Middle Rectus Abdominis',
    'path-59': 'Left Lower Rectus Abdominis',
    'path-60': 'Left Pubic Area',
    'path-61': 'Left Oblique',
    'path-62': 'Left Oblique',
    'path-63': 'Left Oblique',
    'path-64': 'Left Sternocleidomastoideus',
    'path-65': 'Left Trap Front',
    'path-66': 'Left Trapezius',
    'path-67': 'Left Deltoideus',
    'path-68': 'Left Biceps Brachii SH',
    'path-69': 'Left Biceps Brachii LH',
    'path-70': 'Left Forearm Lateral',
    'path-71': 'Right Forearm Central',
    'path-72': 'Left Forearm Medial',
    'path-73': 'Left Patella',
    'path-74': 'Left Medial Knee',
    'path-75': 'Left Calf Front',
    'path-76': 'Left Tibialis Anterior',
    'path-77': 'Left Digitorum Longus',
    'path-78': 'Left Ankle',
    'path-79': 'Left Ankle Ligaments',
    'path-80': 'Left Foot Front',
    'path-81': 'Left Feet Toe',
    'path-82': 'Left Hand Front',
    'path-83': 'Left 5th Finger',
    'path-84': 'Left 4th Finger',
    'path-85': 'Left 3rd Finger',
    'path-86': 'Left 2nd Finger',
    'path-87': 'Left 1st Finger',
    'path-88': 'Left Larynx',
    'path-89': 'Left Pubis Adductor',
    'path-90': 'Left Adductor Long',
    'path-91': 'Left Rectus Femoris',
    'path-92': 'Left Vastus Lateralis',
    'path-93': 'Left Vastus Medialis',
    'path-94': 'Left Adductor Short',
    
    // Back body paths
    'back-head': 'Back Head',
    'left-foot': 'Left Foot',
    'left-gluteus-maximus': 'Left Gluteus Maximus',
    'left-back-trap': 'Left Back Trap',
    'left-infraspinatus': 'Left Infraspinatus',
    'left-back-shoulder': 'Left Back Shoulder',
    'left-teres-major': 'Left Teres Major',
    'left-triceps': 'Left Triceps',
    'left-latisimus-dorsi': 'Left Latisimus Dorsi',
    'left-back-hip': 'Left Back Hip',
    'left-adductor-back': 'Left Adductor Back',
    'left-vastus-lateralis-quad': 'Left Vastus Lateralis Quad',
    'left-bflh': 'Left BFlh',
    'left-semimembranosus': 'Left Semimembranosus',
    'left-lateral-gastrocs': 'Left Lateral Gastrocs',
    'left-medial-gastrocs': 'Left Medial Gastrocs',
    'left-heel': 'Left Heel',
    'left-achilles': 'Left Achilles',
    'left-semitendinosus': 'Left Semitendinosus',
    'left-elbow': 'Left Elbow',
    'left-back-forearm': 'Left Back Forearm',
    'left-gluteus-medius': 'Left Gluteus Medius',
    'left-lower-back': 'Left Lower Back',
    'left-back-upper-trap': 'Left Back Upper Trap',
    'left-back-hand': 'Left Back Hand',
    'left-back-5th-finger': 'Left Back 5th Finger',
    'left-back-4th-finger': 'Left Back 4th Finger',
    'left-back-3rd-finger': 'Left Back 3rd Finger',
    'left-back-2nd-finger': 'Left Back 2nd Finger',
    'left-back-1st-finger': 'Left Back 1st Finger',
    'right-foot': 'Right Foot',
    'right-gluteus-maximus': 'Right Gluteus Maximus',
    'right-back-trap': 'Right Back Trap',
    'right-infraspinatus': 'Right Infraspinatus',
    'right-back-shoulder': 'Right Back Shoulder',
    'right-teres-major': 'Right Teres Major',
    'right-triceps': 'Right Triceps',
    'right-lattisimus-dorsi': 'Right Lattisimus Dorsi',
    'right-back-hip': 'Right Back Hip',
    'right-adductor-back': 'Right Adductor Back',
    'right-vastus-lateralis-quad': 'Right Vastus Lateralis Quad',
    'right-bflh': 'Right BFlh',
    'right-semimembranosus': 'Right Semimembranosus',
    'right-lateral-gastrocs': 'Right Lateral Gastrocs',
    'right-medial-gastrocs': 'Right Medial Gastrocs',
    'right-heel': 'Right Heel',
    'right-achilles': 'Right Achilles',
    'right-semitendinosus': 'Right Semitendinosus',
    'right-elbow': 'Right Elbow',
    'right-back-forearm': 'Right Back Forearm',
    'right-gluteus-medius': 'Right Gluteus Medius',
    'right-lower-back': 'Right Lower Back',
    'right-back-upper-trap': 'Right Back Upper Trap',
    'right-back-hand': 'Right Back Hand',
    'right-back-5th-finger': 'Right Back 5th Finger',
    'right-back-4th-finger': 'Right Back 4th Finger',
    'right-back-3rd-finger': 'Right Back 3rd Finger',
    'right-back-2nd-finger': 'Right Back 2nd Finger',
    'right-back-1st-finger': 'Right Back 1st Finger'
  };
  
  return muscleNames[areaId] || areaId.replace(/-/g, ' ');
};

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
                {format(new Date(response.submittedAt), 'dd/MM/yyyy, HH:mm:ss')}
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {expandedResponse === response.id ? '▼' : '▶'}
            </div>
          </div>
          
          {expandedResponse === response.id && (
            <div className="mt-4 space-y-4">
              {response.answers.map((answer) => {
                // Check if this is body map data
                if (answer.question.type === 'BODY_MAP' && answer.value.includes('{')) {
                  try {
                    const bodyMapData = JSON.parse(answer.value)
                    const isPain = answer.question.text.toLowerCase().includes('painful')
                    const borderColor = isPain ? 'border-red-500' : 'border-green-500'
                    const title = isPain ? 'Body Pain Assessment' : answer.question.text
                    
                    return (
                      <div key={answer.id} className={`border-l-4 ${borderColor} pl-4`}>
                        <h4 className="font-medium text-gray-900 mb-2">{title}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {Object.entries(bodyMapData).map(([area, rating]) => (
                            <div key={area} className="bg-gray-50 p-2 rounded text-sm">
                              <span className="font-medium">{getMuscleName(area)}</span>
                              <span className={`ml-2 font-bold ${isPain ? 'text-red-600' : 'text-orange-600'}`}>{String(rating)}/10</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  } catch {
                    return (
                      <div key={answer.id} className="border-l-4 border-blue-500 pl-4">
                        <h4 className="font-medium text-gray-900">{answer.question.text}</h4>
                        <p className="text-gray-700">{answer.value}</p>
                      </div>
                    )
                  }
                }
                
                // Check if this is the old body map data format (fallback)
                if (answer.question.text.toLowerCase().includes('muscle') && answer.value.includes('{')) {
                  try {
                    const bodyMapData = JSON.parse(answer.value)
                    return (
                      <div key={answer.id} className="border-l-4 border-green-500 pl-4">
                        <h4 className="font-medium text-gray-900 mb-2">{answer.question.text}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {Object.entries(bodyMapData).map(([area, rating]) => (
                            <div key={area} className="bg-gray-50 p-2 rounded text-sm">
                              <span className="font-medium">{getMuscleName(area)}</span>
                              <span className="ml-2 text-blue-600 font-bold">{String(rating)}/10</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  } catch {
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
