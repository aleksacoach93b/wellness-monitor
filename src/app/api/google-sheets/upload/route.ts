import { NextRequest, NextResponse } from 'next/server'
import { googleSheetsService } from '@/lib/googleSheets'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const { surveyId } = await request.json()

    if (!surveyId) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 })
    }

    // Get survey with all data
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
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
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    // Get all active players for filtering
    const allPlayers = await prisma.player.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true }
    })
    
    const validPlayerIds = new Set(allPlayers.map(p => p.id))
    
    // Filter responses to only include players that exist
    const filteredResponses = survey.responses.filter(response => 
      response.playerId && validPlayerIds.has(response.playerId)
    )

    // Setup sheet headers first
    await googleSheetsService.setupSheetHeaders(surveyId, survey.questions)

    // Upload each response
    for (const response of filteredResponses) {
      const answers = response.answers.map(answer => ({
        questionText: answer.question.text,
        questionType: answer.question.type,
        answer: answer.value
      }))

      // Extract body map data if present
      let bodyMapData: Record<string, number> | null = null
      const bodyMapAnswers = response.answers.filter(answer => 
        answer.question.text.toLowerCase().includes('painful') || 
        answer.question.text.toLowerCase().includes('sore') ||
        answer.question.text.toLowerCase().includes('muscle') ||
        answer.question.text.toLowerCase().includes('body')
      )

      if (bodyMapAnswers.length > 0) {
        bodyMapData = {}
        bodyMapAnswers.forEach(answer => {
          if (answer.value && answer.value.includes('{')) {
            try {
              const parsed = JSON.parse(answer.value)
              Object.assign(bodyMapData!, parsed)
            } catch (e) {
              console.error('Error parsing body map data:', e)
            }
          }
        })
      }

      await googleSheetsService.appendSurveyResponse({
        surveyId: response.surveyId,
        surveyTitle: survey.title,
        playerId: response.playerId || undefined,
        playerName: response.playerName || undefined,
        playerEmail: response.playerEmail || undefined,
        submittedAt: format(new Date(response.submittedAt), 'yyyy-MM-dd HH:mm:ss'),
        answers,
        bodyMapData
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully uploaded ${filteredResponses.length} responses to Google Sheets`,
      uploadedCount: filteredResponses.length
    })

  } catch (error) {
    console.error('Error uploading to Google Sheets:', error)
    return NextResponse.json({ 
      error: 'Failed to upload to Google Sheets',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
