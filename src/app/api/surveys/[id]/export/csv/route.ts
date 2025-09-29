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

    // First, get ALL possible Body Map columns for ALL Body Map questions
    const allBodyMapColumns: string[] = []
    survey.questions.forEach(question => {
      if (question.type === 'BODY_MAP') {
        // ALWAYS add all possible body parts for BODY_MAP questions to maintain consistent structure
        const allBodyMapIds = [
          // Front body paths
          'path-4', 'path-5', 'path-7', 'path-8', 'path-9', 'path-10', 'path-11', 'path-12', 'path-13', 'path-14', 'path-15', 'path-16', 'path-17', 'path-18', 'path-19', 'path-20', 'path-21', 'path-22', 'path-23', 'path-24', 'path-25', 'path-26', 'path-27', 'path-28', 'path-29', 'path-30', 'path-31', 'path-32', 'path-33', 'path-34', 'path-35', 'path-36', 'path-37', 'path-38', 'path-39', 'path-40', 'path-41', 'path-42', 'path-43', 'path-44', 'path-45', 'path-46', 'path-47', 'path-48', 'path-49', 'path-50', 'path-51', 'path-52', 'path-53', 'path-54', 'path-55', 'path-56', 'path-57', 'path-58', 'path-59', 'path-60', 'path-61', 'path-62', 'path-63', 'path-64', 'path-65', 'path-66', 'path-67', 'path-68', 'path-69', 'path-70', 'path-71', 'path-72', 'path-73', 'path-74', 'path-75', 'path-76', 'path-77', 'path-78', 'path-79', 'path-80', 'path-81', 'path-82', 'path-83', 'path-84', 'path-85', 'path-86', 'path-87', 'path-88', 'path-89', 'path-90', 'path-91', 'path-92', 'path-93', 'path-94',
          // Back body areas - using EXACT IDs from BodyMap component
          'left-bflh', 'right-bflh', 'left-semimembranosus', 'right-semimembranosus', 'left-semitendinosus', 'right-semitendinosus', 'left-gluteus-maximus', 'right-gluteus-maximus', 'left-gluteus-medius', 'right-gluteus-medius', 'left-infraspinatus', 'right-infraspinatus', 'left-back-trap', 'right-back-trap', 'left-back-upper-trap', 'right-back-upper-trap', 'left-latissimus-dorsi', 'right-latissimus-dorsi', 'left-teres-major', 'right-teres-major', 'left-lower-back', 'right-lower-back', 'left-achilles', 'right-achilles', 'left-achilles-2', 'right-achilles-2', 'left-foot', 'right-foot', 'left-heel', 'right-heel', 'left-lateral-gastrocs', 'right-lateral-gastrocs', 'left-medial-gastrocs', 'right-medial-gastrocs', 'left-vastus-lateralis-quad', 'right-vastus-lateralis-quad', 'left-triceps', 'right-triceps', 'left-elbow', 'right-elbow', 'left-back-shoulder', 'right-back-shoulder', 'left-back-hip', 'right-back-hip', 'left-back-forearm', 'right-back-forearm', 'left-back-hand', 'right-back-hand', 'left-back-1st-finger', 'right-back-1st-finger', 'left-back-2nd-finger', 'right-back-2nd-finger', 'left-back-3rd-finger', 'right-back-3rd-finger', 'left-back-4th-finger', 'right-back-4th-finger', 'left-back-5th-finger', 'right-back-5th-finger', 'left-adductor-back', 'right-adductor-back', 'back-head'
        ]
        
        allBodyMapIds.forEach(areaId => {
          const muscleName = getMuscleName(areaId)
          const columnName = `${question.text} - ${muscleName}`
          allBodyMapColumns.push(columnName)
        })
      }
    })

    // Create flattened CSV data - each response as one row with ALL body parts as columns
    const csvData = survey.responses.map(response => {
      const row: Record<string, string | number | null> = {
        playerName: response.player ? `${response.player.firstName} ${response.player.lastName}` : 'Unknown Player',
        playerEmail: response.player?.email || '',
        submittedAt: response.submittedAt.toISOString(),
        surveyTitle: survey.title
      }
      
      // Add non-Body Map questions as columns, and Body Map questions that don't have JSON data
      survey.questions.forEach(question => {
        if (question.type !== 'BODY_MAP') {
          const answer = response.answers.find(a => a.questionId === question.id)
          row[question.text] = answer?.value || ''
        } else {
          // For BODY_MAP questions, check if they have JSON data
          const answer = response.answers.find(a => a.questionId === question.id)
          if (answer?.value && !(answer.value.trim().startsWith('{') && answer.value.trim().endsWith('}'))) {
            // If it's not JSON, treat it as a regular question
            row[question.text] = answer.value
          }
        }
      })
      
      // Initialize ALL Body Map columns as empty
      allBodyMapColumns.forEach(columnName => {
        row[columnName] = ''
      })
      
      // Fill in actual Body Map data where available
      survey.questions.forEach(question => {
        if (question.type === 'BODY_MAP') {
          const answer = response.answers.find(a => a.questionId === question.id)
          
          if (answer?.value && answer.value !== 'No') {
            try {
              // Only try to parse as JSON if it looks like JSON (starts with { and ends with })
              if (answer.value.trim().startsWith('{') && answer.value.trim().endsWith('}')) {
                const bodyMapData = JSON.parse(answer.value)
                
                // Convert areaId to muscle name and create column name
                Object.entries(bodyMapData).forEach(([areaId, value]) => {
                  const muscleName = getMuscleName(areaId)
                  // Create column name like "Painful Areas - Right Pectoralis Major"
                  const columnName = `${question.text} - ${muscleName}`
                  row[columnName] = value as number
                })
              } else {
                // If it's not JSON, treat it as a regular answer and put it in the main question column
                row[question.text] = answer.value
              }
            } catch (e) {
              // If JSON parsing fails, treat it as a regular answer
              row[question.text] = answer.value
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
      headers.map(header => {
        // Escape CSV headers that contain commas or quotes
        if (header.includes(',') || header.includes('"') || header.includes('\n')) {
          return `"${header.replace(/"/g, '""')}"`
        }
        return header
      }).join(','),
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
