import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSurveySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  questions: z.array(z.object({
    text: z.string().min(1, 'Question text is required'),
    type: z.enum(['TEXT', 'NUMBER', 'EMAIL', 'SELECT', 'MULTIPLE_SELECT', 'SCALE', 'BOOLEAN', 'BODY_MAP', 'RATING_SCALE', 'SLIDER', 'TIME']),
    options: z.array(z.string()).optional(),
    required: z.boolean().default(true),
    order: z.number().default(0),
  })).min(1, 'At least one question is required')
})

export async function POST(request: NextRequest) {
  try {
    console.log('=== SURVEY CREATION START ===')
    const body = await request.json()
    console.log('Raw request body:', JSON.stringify(body, null, 2))
    
    const validatedData = createSurveySchema.parse(body)
    console.log('Validated data:', JSON.stringify(validatedData, null, 2))

    const survey = await prisma.survey.create({
      data: {
        title: validatedData.title,
        description: validatedData.description || null,
        createdBy: 'admin', // Simple admin identifier for now
        questions: {
          create: validatedData.questions.map(q => ({
            text: q.text,
            type: q.type,
            options: q.options ? JSON.stringify(q.options) : null,
            required: q.required,
            order: q.order,
          }))
        }
      },
      include: {
        questions: true
      }
    })

    console.log('Survey created successfully:', survey.id)
    console.log('=== SURVEY CREATION END ===')
    return NextResponse.json(survey)
  } catch (error) {
    console.error('Error creating survey:', error)
    
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
        error: 'Failed to create survey',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const surveys = await prisma.survey.findMany({
      include: {
        _count: {
          select: {
            questions: true,
            responses: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(surveys)
  } catch (error) {
    console.error('Error fetching surveys:', error)
    return NextResponse.json(
      { error: 'Failed to fetch surveys' },
      { status: 500 }
    )
  }
}
