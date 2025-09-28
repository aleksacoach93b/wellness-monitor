import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
            answers: true
          },
          orderBy: { submittedAt: 'desc' }
        }
      }
    })
    
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }
    
    // Format data for Power BI
    const powerBiData = {
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        createdAt: survey.createdAt,
        isRecurring: survey.isRecurring,
        startDate: survey.startDate,
        endDate: survey.endDate,
        dailyStartTime: survey.dailyStartTime,
        dailyEndTime: survey.dailyEndTime
      },
      questions: survey.questions.map(q => ({
        id: q.id,
        text: q.text,
        type: q.type,
        options: q.options,
        required: q.required,
        order: q.order
      })),
      responses: survey.responses.map(r => ({
        id: r.id,
        playerId: r.playerId,
        playerName: r.playerName,
        playerEmail: r.playerEmail,
        submittedAt: r.submittedAt,
        answers: r.answers.map(a => ({
          id: a.id,
          questionId: a.questionId,
          value: a.value
        }))
      })),
      // Flattened data for easier Power BI consumption
      flattenedData: survey.responses.flatMap(response => 
        response.answers.map(answer => {
          const question = survey.questions.find(q => q.id === answer.questionId)
          return {
            responseId: response.id,
            playerId: response.playerId,
            playerName: response.playerName,
            playerEmail: response.playerEmail,
            submittedAt: response.submittedAt,
            questionId: answer.questionId,
            questionText: question?.text || '',
            questionType: question?.type || '',
            answerValue: answer.value,
            // Survey metadata
            surveyId: survey.id,
            surveyTitle: survey.title,
            surveyCreatedAt: survey.createdAt,
            surveyIsRecurring: survey.isRecurring
          }
        })
      )
    }
    
    // Return as JSON for Power BI import
    return NextResponse.json(powerBiData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="survey-${survey.id}-powerbi.json"`
      }
    })
    
  } catch (error) {
    console.error('Error exporting Power BI data:', error)
    return NextResponse.json(
      { error: 'Failed to export Power BI data' },
      { status: 500 }
    )
  }
}
