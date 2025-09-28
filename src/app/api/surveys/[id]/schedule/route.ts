import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const { startDate, endDate, dailyStartTime, dailyEndTime } = body

    // Validate required fields
    if (!startDate || !endDate || !dailyStartTime || !dailyEndTime) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Validate date format
    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)
    
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      )
    }

    // Validate that end date is after start date
    if (endDateObj <= startDateObj) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(dailyStartTime) || !timeRegex.test(dailyEndTime)) {
      return NextResponse.json(
        { error: 'Invalid time format. Use HH:MM format' },
        { status: 400 }
      )
    }

    // Validate that end time is after start time
    const [startHour, startMinute] = dailyStartTime.split(':').map(Number)
    const [endHour, endMinute] = dailyEndTime.split(':').map(Number)
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute
    
    if (endMinutes <= startMinutes) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      )
    }

    // Check if survey exists and is recurring
    const survey = await prisma.survey.findUnique({
      where: { id }
    })

    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      )
    }

    // Update the survey schedule and make it recurring
    const updatedSurvey = await prisma.survey.update({
      where: { id },
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        dailyStartTime,
        dailyEndTime,
        isRecurring: true, // Make survey recurring when schedule is set
      }
    })

    return NextResponse.json({
      message: 'Schedule updated successfully',
      survey: updatedSurvey
    })

  } catch (error) {
    console.error('Error updating survey schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
