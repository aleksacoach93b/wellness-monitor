import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { shouldUpdateSurveyStatus } from '@/lib/recurringSurvey'

export async function POST(request: NextRequest) {
  try {
    // Get all recurring surveys
    const recurringSurveys = await prisma.survey.findMany({
      where: {
        isRecurring: true
      }
    })

    const updates = []

    for (const survey of recurringSurveys) {
      if (shouldUpdateSurveyStatus(survey)) {
        const status = isRecurringSurveyActive(survey)
        
        const updatedSurvey = await prisma.survey.update({
          where: { id: survey.id },
          data: { 
            isActive: status.isCurrentlyActive,
            updatedAt: new Date()
          }
        })

        updates.push({
          surveyId: survey.id,
          title: survey.title,
          oldStatus: survey.isActive,
          newStatus: status.isCurrentlyActive,
          message: status.statusMessage
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updates.length} surveys`,
      updates
    })

  } catch (error) {
    console.error('Error updating recurring surveys:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update surveys' },
      { status: 500 }
    )
  }
}

// Helper function to check if survey should be active
function isRecurringSurveyActive(survey: { isRecurring: boolean; isActive: boolean; dailyStartTime?: string | null; dailyEndTime?: string | null; startDate?: Date | null; endDate?: Date | null }): { isCurrentlyActive: boolean; statusMessage: string } {
  if (!survey.isRecurring || !survey.dailyStartTime || !survey.dailyEndTime) {
    return {
      isCurrentlyActive: survey.isActive,
      statusMessage: survey.isActive ? 'Survey je aktivan' : 'Survey je neaktivan'
    }
  }

  const now = new Date()
  const belgradeTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Belgrade" }))
  
  // Check if we're within the overall date range
  if (survey.startDate && belgradeTime < survey.startDate) {
    return {
      isCurrentlyActive: false,
      statusMessage: `Survey počinje ${survey.startDate.toLocaleDateString('sr-RS')}`
    }
  }

  if (survey.endDate && belgradeTime > survey.endDate) {
    return {
      isCurrentlyActive: false,
      statusMessage: `Survey je završen ${survey.endDate.toLocaleDateString('sr-RS')}`
    }
  }

  // Check daily time range
  const currentTime = belgradeTime.toTimeString().slice(0, 5) // "HH:MM" format
  const startTime = survey.dailyStartTime
  const endTime = survey.dailyEndTime

  const isInDailyRange = currentTime >= startTime && currentTime <= endTime

  if (isInDailyRange) {
    return {
      isCurrentlyActive: true,
      statusMessage: `Survey aktivan do ${endTime}`
    }
  } else {
    return {
      isCurrentlyActive: false,
      statusMessage: `Sledeći survey počinje sutra u ${startTime}`
    }
  }
}
