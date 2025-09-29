import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Body Map path ID to muscle name mapping
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
    'path-71': 'Left Forearm Central',
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
    'path-122': 'Left Foot Back'
  }
  
  return muscleNames[areaId] || areaId
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch survey with all related data
    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' }
        },
        responses: {
          include: {
            player: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            },
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
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    // Create flattened CSV data - each response as one row with all body parts as columns
    const csvData = survey.responses.map(response => {
      const row: Record<string, string | number | null> = {
        responseId: response.id,
        playerName: response.player ? `${response.player.firstName} ${response.player.lastName}` : 'Unknown Player',
        playerEmail: response.player?.email || '',
        submittedAt: response.submittedAt.toISOString(),
        surveyTitle: survey.title
      }
      
      // Add non-Body Map questions as columns
      survey.questions.forEach(question => {
        if (question.type !== 'BODY_MAP') {
          const answer = response.answers.find(a => a.questionId === question.id)
          row[question.text] = answer?.value || ''
        }
      })
      
      // Add Body Map questions - each body part as separate column
      survey.questions.forEach(question => {
        if (question.type === 'BODY_MAP') {
          const answer = response.answers.find(a => a.questionId === question.id)
          
          if (answer?.value && answer.value !== 'No') {
            try {
              const bodyMapData = JSON.parse(answer.value)
              
              // Convert path IDs to readable names and create separate columns for each body part
              Object.entries(bodyMapData).forEach(([key, value]) => {
                let muscleName = key
                if (key.startsWith('path-')) {
                  muscleName = getMuscleName(key)
                }
                
                // Create column name like "Painful Areas - Right Pectoralis"
                const columnName = `${question.text} - ${muscleName}`
                row[columnName] = value as number
              })
            } catch (e) {
              // If JSON parsing fails, skip
            }
          }
        }
      })
      
      return row
    })

    // Convert to CSV format
    if (csvData.length === 0) {
      return new NextResponse('No data available', {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${survey.title}-export.csv"`
        }
      })
    }

    // Create CSV headers
    const headers = Object.keys(csvData[0])
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row]
          // Escape CSV values that contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }).join(',')
      )
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${survey.title}-export.csv"`
      }
    })

  } catch (error) {
    console.error('Error exporting survey to CSV:', error)
    return NextResponse.json(
      { error: 'Failed to export survey data' },
      { status: 500 }
    )
  }
}
