import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { googleSheetsService } from '@/lib/googleSheets'

export async function POST(request: NextRequest) {
  try {
    const { surveyId } = await request.json()

    if (!surveyId) {
      return NextResponse.json(
        { error: 'Survey ID is required' },
        { status: 400 }
      )
    }

    // Get survey with all responses
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
          orderBy: { submittedAt: 'asc' }
        }
      }
    })

    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      )
    }

    // Setup sheet headers
    await googleSheetsService.setupSheetHeaders(surveyId, survey.questions)

    // Export all responses
    const exportPromises = survey.responses.map(response => 
      googleSheetsService.appendSurveyResponse({
        surveyId: response.surveyId,
        surveyTitle: survey.title,
        playerId: response.playerId || undefined,
        playerName: response.playerName || undefined,
        playerEmail: response.playerEmail || undefined,
        submittedAt: response.submittedAt.toISOString(),
        answers: response.answers.map(answer => ({
          questionText: answer.question.text,
          questionType: answer.question.type,
          answer: answer.value
        }))
      })
    )

    await Promise.all(exportPromises)

    return NextResponse.json({
      success: true,
      message: `Successfully exported ${survey.responses.length} responses to Google Sheets`,
      surveyId,
      responseCount: survey.responses.length
    })

  } catch (error) {
    console.error('Error exporting to Google Sheets:', error)
    return NextResponse.json(
      { error: 'Failed to export to Google Sheets' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Get all surveys with response counts
    const surveys = await prisma.survey.findMany({
      include: {
        _count: {
          select: {
            responses: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      surveys: surveys.map(survey => ({
        id: survey.id,
        title: survey.title,
        responseCount: survey._count.responses,
        createdAt: survey.createdAt
      }))
    })

  } catch (error) {
    console.error('Error fetching surveys for export:', error)
    return NextResponse.json(
      { error: 'Failed to fetch surveys' },
      { status: 500 }
    )
  }
}
