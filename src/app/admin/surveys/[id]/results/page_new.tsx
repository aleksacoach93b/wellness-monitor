import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Download, Users, BarChart3 } from 'lucide-react'
import ResultsTable from './ResultsTable'
import HomeButton from '@/components/HomeButton'
import PowerBILink from '@/components/PowerBILink'
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
    'path-85': 'Left 5th Finger',
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
    'path-95': 'Right Trapezius Back',
    'path-96': 'Right Deltoideus Back',
    'path-97': 'Right Infraspinatus',
    'path-98': 'Right Teres Major',
    'path-99': 'Right Latissimus Dorsi',
    'path-100': 'Right Erector Spinae',
    'path-101': 'Right Gluteus Maximus',
    'path-102': 'Right Gluteus Medius',
    'path-103': 'Right Hamstring',
    'path-104': 'Right BFLH',
    'path-105': 'Right Calf Back',
    'path-106': 'Right Soleus',
    'path-107': 'Right Achilles',
    'path-108': 'Right Foot Back',
    'path-109': 'Left Trapezius Back',
    'path-110': 'Left Deltoideus Back',
    'path-111': 'Left Infraspinatus',
    'path-112': 'Left Teres Major',
    'path-113': 'Left Latissimus Dorsi',
    'path-114': 'Left Erector Spinae',
    'path-115': 'Left Gluteus Maximus',
    'path-116': 'Left Gluteus Medius',
    'path-117': 'Left Hamstring',
    'path-118': 'Left BFLH',
    'path-119': 'Left Calf Back',
    'path-120': 'Left Soleus',
    'path-121': 'Left Achilles',
    'path-122': 'Left Foot Back',
    
    // Back body areas - using EXACT IDs from BodyMap component
    'left-bflh': 'Left BFlh',
    'right-bflh': 'Right BFlh',
    'left-semimembranosus': 'Left Semimembranosus',
    'right-semimembranosus': 'Right Semimembranosus',
    'left-semitendinosus': 'Left Semitendinosus',
    'right-semitendinosus': 'Right Semitendinosus',
    'left-gluteus-maximus': 'Left Gluteus Maximus',
    'right-gluteus-maximus': 'Right Gluteus Maximus',
    'left-gluteus-medius': 'Left Gluteus Medius',
    'right-gluteus-medius': 'Right Gluteus Medius',
    'left-infraspinatus': 'Left Infraspinatus',
    'right-infraspinatus': 'Right Infraspinatus',
    'left-back-trap': 'Left Back Trap',
    'right-back-trap': 'Right Back Trap',
    'left-back-upper-trap': 'Left Back Upper Trap',
    'right-back-upper-trap': 'Right Back Upper Trap',
    'left-latissimus-dorsi': 'Left Latissimus Dorsi',
    'right-latissimus-dorsi': 'Right Latissimus Dorsi',
    'left-teres-major': 'Left Teres Major',
    'right-teres-major': 'Right Teres Major',
    'left-lower-back': 'Left Lower Back',
    'right-lower-back': 'Right Lower Back',
    'left-achilles': 'Left Achilles',
    'right-achilles': 'Right Achilles',
    'left-achilles-2': 'Left Achilles 2',
    'right-achilles-2': 'Right Achilles 2',
    'left-foot': 'Left Foot Back',
    'right-foot': 'Right Foot Back',
    'left-heel': 'Left Heel',
    'right-heel': 'Right Heel',
    'left-lateral-gastrocs': 'Left Lateral Gastrocs',
    'right-lateral-gastrocs': 'Right Lateral Gastrocs',
    'left-medial-gastrocs': 'Left Medial Gastrocs',
    'right-medial-gastrocs': 'Right Medial Gastrocs',
    'left-vastus-lateralis-quad': 'Left Vastus Lateralis Quad',
    'right-vastus-lateralis-quad': 'Right Vastus Lateralis Quad',
    'left-triceps': 'Left Triceps',
    'right-triceps': 'Right Triceps',
    'left-elbow': 'Left Elbow',
    'right-elbow': 'Right Elbow',
    'left-back-shoulder': 'Left Back Shoulder',
    'right-back-shoulder': 'Right Back Shoulder',
    'left-back-hip': 'Left Back Hip',
    'right-back-hip': 'Right Back Hip',
    'left-back-forearm': 'Left Back Forearm',
    'right-back-forearm': 'Right Back Forearm',
    'left-back-hand': 'Left Back Hand',
    'right-back-hand': 'Right Back Hand',
    'left-back-1st-finger': 'Left Back 1st Finger',
    'right-back-1st-finger': 'Right Back 1st Finger',
    'left-back-2nd-finger': 'Left Back 2nd Finger',
    'right-back-2nd-finger': 'Right Back 2nd Finger',
    'left-back-3rd-finger': 'Left Back 3rd Finger',
    'right-back-3rd-finger': 'Right Back 3rd Finger',
    'left-back-4th-finger': 'Left Back 4th Finger',
    'right-back-4th-finger': 'Right Back 4th Finger',
    'left-back-5th-finger': 'Left Back 5th Finger',
    'right-back-5th-finger': 'Right Back 5th Finger',
    'left-adductor-back': 'Left Adductor Back',
    'right-adductor-back': 'Right Adductor Back',
    'back-head': 'Back Head'
  }
  
  return muscleNames[areaId] || areaId
}

interface SurveyResultsPageProps {
  params: {
    id: string
  }
}

export default async function SurveyResultsPage({ params }: SurveyResultsPageProps) {
  const survey = await prisma.survey.findUnique({
    where: { id: params.id },
    include: {
      questions: {
        orderBy: { order: 'asc' }
      },
      responses: {
        include: {
          answers: true
        },
        orderBy: { submittedAt: 'desc' }
      }
    }
  })

  if (!survey) {
    notFound()
  }

  // Get all valid player IDs to filter responses
  const players = await prisma.player.findMany({
    select: { id: true }
  })
  const validPlayerIds = new Set(players.map(p => p.id))
  
  // Filter responses to only include players that exist in the players table
  const filteredResponses = survey.responses.filter(response => 
    response.playerId && validPlayerIds.has(response.playerId)
  )
  
  // Update survey object with filtered responses
  survey.responses = filteredResponses

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <HomeButton />
        </div>

        {/* Header */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{survey.title}</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Created {format(new Date(survey.createdAt), 'MMMM d, yyyy')}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="h-4 w-4 mr-1" />
                    {survey.responses.length} responses
                  </div>
                  <div className="flex items-center text-sm text-gray-600 mt-1">
                    <BarChart3 className="h-4 w-4 mr-1" />
                    {survey.questions.length} questions
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Survey Responses</h2>
              <div className="flex space-x-3">
                <a
                  href={`/api/surveys/${survey.id}/export/csv`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV Link for Power BI
                </a>
                <PowerBILink surveyId={survey.id} surveyTitle={survey.title} />
              </div>
            </div>
          </div>
          <ResultsTable survey={survey} getMuscleName={getMuscleName} />
        </div>
      </div>
    </div>
  )
}
