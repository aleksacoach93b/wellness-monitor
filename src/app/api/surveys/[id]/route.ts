import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSurveySchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  questions: z.array(z.object({
    id: z.string().optional(), // Allow undefined for new questions
    text: z.string().min(1),
    type: z.enum(['TEXT', 'NUMBER', 'EMAIL', 'SELECT', 'MULTIPLE_SELECT', 'SCALE', 'BOOLEAN', 'BODY_MAP', 'RATING_SCALE', 'RPE', 'SLIDER', 'TIME']),
    options: z.string().nullable().optional(),
    required: z.boolean(),
    order: z.number()
  }))
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params

    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(survey)
  } catch (error) {
    console.error('Error fetching survey:', error)
    return NextResponse.json(
      { error: 'Failed to fetch survey' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('=== SURVEY UPDATE START ===')
    const { id: surveyId } = await params
    console.log('Survey ID:', surveyId)
    
    const body = await request.json()
    console.log('Raw request body:', JSON.stringify(body, null, 2))
    
    const validatedData = updateSurveySchema.parse(body)
    console.log('Validated data:', JSON.stringify(validatedData, null, 2))

    // Update the survey
    const updatedSurvey = await prisma.survey.update({
      where: { id: surveyId },
      data: {
        title: validatedData.title,
        description: validatedData.description || null
      }
    })

    // Delete existing questions
    await prisma.question.deleteMany({
      where: { surveyId: surveyId }
    })

    // Create new questions
    for (const questionData of validatedData.questions) {
      await prisma.question.create({
        data: {
          surveyId: surveyId,
          text: questionData.text,
          type: questionData.type,
          options: questionData.options,
          required: questionData.required,
          order: questionData.order
        }
      })
    }

    console.log('Survey updated successfully:', updatedSurvey.id)
    console.log('=== SURVEY UPDATE END ===')
    return NextResponse.json(updatedSurvey)
  } catch (error) {
    console.error('=== SURVEY UPDATE ERROR ===')
    console.error('Error updating survey:', error)
    
    if (error instanceof z.ZodError) {
      console.error('Validation error details:', error.issues)
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code
          }))
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to update survey',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params

    // Delete the survey and all related data (cascade delete)
    await prisma.survey.delete({
      where: { id: surveyId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting survey:', error)
    return NextResponse.json(
      { error: 'Failed to delete survey' },
      { status: 500 }
    )
  }
}
