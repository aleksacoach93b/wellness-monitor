import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { googleSheetsService } from '@/lib/googleSheets'
import { z } from 'zod'

const submitResponseSchema = z.object({
  surveyId: z.string(),
  playerId: z.string().optional().nullable(),
  playerName: z.string().optional().nullable(),
  playerEmail: z.string().optional().nullable(),
  answers: z.array(z.object({
    questionId: z.string(),
    value: z.string()
  })),
  bodyMapData: z.record(z.string(), z.number()).optional().nullable()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received survey submission:', body)
    const validatedData = submitResponseSchema.parse(body)
    console.log('Validated data:', validatedData)

    // Verify survey exists and is active
    const survey = await prisma.survey.findUnique({
      where: {
        id: validatedData.surveyId,
        isActive: true
      },
      include: {
        questions: true
      }
    })

    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found or inactive' },
        { status: 404 }
      )
    }

    // Create response with answers
    console.log('Creating response with data:', {
      surveyId: validatedData.surveyId,
      playerId: validatedData.playerId || null,
      playerName: validatedData.playerName || null,
      playerEmail: validatedData.playerEmail || null,
      answersCount: validatedData.answers.length
    })
    
    const response = await prisma.response.create({
      data: {
        surveyId: validatedData.surveyId,
        ...(validatedData.playerId && { playerId: validatedData.playerId }),
        ...(validatedData.playerName && { playerName: validatedData.playerName }),
        ...(validatedData.playerEmail && { playerEmail: validatedData.playerEmail }),
        answers: {
          create: validatedData.answers.map(answer => ({
            questionId: answer.questionId,
            value: answer.value
          }))
        }
      },
      include: {
        answers: {
          include: {
            question: true
          }
        }
      }
    })
    
    console.log('Response created successfully:', response.id)

    // Export to Google Sheets if enabled
    if (process.env.ENABLE_GOOGLE_SHEETS === 'true') {
      try {
        await googleSheetsService.appendSurveyResponse({
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
          })),
          bodyMapData: validatedData.bodyMapData
        })
      } catch (sheetsError) {
        console.error('Failed to export to Google Sheets:', sheetsError)
        // Don't fail the response if Google Sheets export fails
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error submitting response:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
    
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.errors)
      console.error('Failed validation details:', error.errors.map(e => ({
        path: e.path,
        message: e.message,
        code: e.code
      })))
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to submit response', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
