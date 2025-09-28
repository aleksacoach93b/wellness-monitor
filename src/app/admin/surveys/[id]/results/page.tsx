import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Download, BarChart3, Users, Calendar } from 'lucide-react'
import ResultsTable from './ResultsTable'
import HomeButton from '@/components/HomeButton'
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

interface ResultsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { id } = await params
  
  // Get all active players first
  const allPlayers = await prisma.player.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true }
  })
  
  // Create a set of valid player IDs for faster lookup
  const validPlayerIds = new Set(allPlayers.map(p => p.id))
  
  const survey = await prisma.survey.findUnique({
    where: { id: id },
    include: {
      questions: {
        orderBy: { order: 'asc' }
      },
      responses: {
        include: {
          answers: {
            include: {
              question: true
            }
          }
        },
        orderBy: { submittedAt: 'desc' }
      }
    }
  })

  if (!survey) {
    notFound()
  }
  
  // Filter responses to only include players that exist in the players table
  const filteredResponses = survey.responses.filter(response => 
    response.playerId && validPlayerIds.has(response.playerId)
  )
  
  // Update survey object with filtered responses
  survey.responses = filteredResponses

  const exportToCSV = async () => {
    'use server'
    
    const csvData = []
    
    // Get all possible muscle areas from the muscle names mapping
    const allMuscleAreas = Object.keys({
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
    }).sort()
    
    // Create headers
    const headers = ['Response ID', 'Player Name', 'Player Email', 'Submitted At']
    
    // Add regular question headers
    survey.questions.forEach(question => {
      if (!(question.text.toLowerCase().includes('painful') || question.text.toLowerCase().includes('sore') || question.text.toLowerCase().includes('muscle') || question.text.toLowerCase().includes('body'))) {
        headers.push(question.text)
      }
    })
    
    // Add body map headers for each muscle area
    survey.questions.forEach(question => {
      if ((question.text.toLowerCase().includes('painful') || question.text.toLowerCase().includes('sore') || question.text.toLowerCase().includes('muscle') || question.text.toLowerCase().includes('body'))) {
        allMuscleAreas.forEach(area => {
          headers.push(`${question.text} - ${getMuscleName(area)}`)
        })
      }
    })
    
    csvData.push(headers.join(','))
    
    // Data rows
    survey.responses.forEach(response => {
      const row = [
        response.id,
        response.playerName || '',
        response.playerEmail || '',
        format(new Date(response.submittedAt), 'yyyy-MM-dd HH:mm:ss')
      ]
      
      // Add regular question answers
      survey.questions.forEach(question => {
        if (!(question.text.toLowerCase().includes('painful') || question.text.toLowerCase().includes('sore') || question.text.toLowerCase().includes('muscle') || question.text.toLowerCase().includes('body'))) {
          const answer = response.answers.find(a => a.questionId === question.id)
          let value = answer?.value || ''
          
          // Clean up the value for CSV
          if (value.includes(',')) {
            value = `"${value}"`
          }
          row.push(value)
        }
      })
      
      // Add body map answers for each muscle area
      survey.questions.forEach(question => {
        if ((question.text.toLowerCase().includes('painful') || question.text.toLowerCase().includes('sore') || question.text.toLowerCase().includes('muscle') || question.text.toLowerCase().includes('body'))) {
          const answer = response.answers.find(a => a.questionId === question.id)
          let bodyMapData: Record<string, number> = {}
          
          if (answer?.value && answer.value.includes('{')) {
            try {
              bodyMapData = JSON.parse(answer.value)
            } catch (e) {
              // If parsing fails, keep empty object
            }
          }
          
          // Add value for each muscle area (empty if not selected)
          allMuscleAreas.forEach(area => {
            const value = bodyMapData[area] || ''
            row.push(String(value))
          })
        }
      })
      
      csvData.push(row.join(','))
    })
    
    return csvData.join('\n')
  }

  const csvContent = await exportToCSV()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{survey.title} - Results</h1>
              <p className="mt-2 text-gray-600">View and analyze survey responses</p>
            </div>
            <HomeButton />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Responses</p>
                <p className="text-2xl font-semibold text-gray-900">{survey.responses.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Questions</p>
                <p className="text-2xl font-semibold text-gray-900">{survey.questions.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Latest Response</p>
                <p className="text-sm font-semibold text-gray-900">
                  {survey.responses.length > 0 
                    ? format(new Date(survey.responses[0].submittedAt), 'MMM dd, yyyy')
                    : 'No responses'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Survey Responses</h2>
              <div className="flex space-x-3">
                <a
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`}
                  download={`${survey.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results.csv`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </a>
              </div>
            </div>
          </div>

          <ResultsTable responses={survey.responses} />
        </div>
      </div>
    </div>
  )
}
