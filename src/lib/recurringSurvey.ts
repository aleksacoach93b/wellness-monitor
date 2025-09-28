import { Survey } from '@prisma/client'

export interface RecurringSurveyStatus {
  isCurrentlyActive: boolean
  nextActivation?: Date
  nextDeactivation?: Date
  timeUntilNext?: string
  statusMessage: string
}

/**
 * Check if a recurring survey should be active based on current time
 */
export function isRecurringSurveyActive(survey: Survey): RecurringSurveyStatus {
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
      nextActivation: survey.startDate,
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
    // Calculate when it will end today
    const today = new Date(belgradeTime)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    const endToday = new Date(today)
    endToday.setHours(endHour, endMinute, 0, 0)

    return {
      isCurrentlyActive: true,
      nextDeactivation: endToday,
      timeUntilNext: getTimeUntil(endToday),
      statusMessage: `Survey aktivan do ${endTime}`
    }
  } else {
    // Calculate next activation
    const tomorrow = new Date(belgradeTime)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const nextActivation = new Date(tomorrow)
    nextActivation.setHours(startHour, startMinute, 0, 0)

    return {
      isCurrentlyActive: false,
      nextActivation,
      timeUntilNext: getTimeUntil(nextActivation),
      statusMessage: `Sledeći survey počinje sutra u ${startTime}`
    }
  }
}

/**
 * Get time until a specific date in a readable format
 */
function getTimeUntil(targetDate: Date): string {
  const now = new Date()
  const diff = targetDate.getTime() - now.getTime()
  
  if (diff <= 0) return 'Sada'
  
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

/**
 * Check if a survey should be automatically activated/deactivated
 */
export function shouldUpdateSurveyStatus(survey: Survey): boolean {
  if (!survey.isRecurring) return false
  
  const status = isRecurringSurveyActive(survey)
  return status.isCurrentlyActive !== survey.isActive
}

/**
 * Format recurring survey info for display
 */
export function formatRecurringInfo(survey: Survey): string {
  if (!survey.isRecurring) return 'Jednokratni survey'
  
  const startDate = survey.startDate?.toLocaleDateString('sr-RS') || 'Nepoznato'
  const endDate = survey.endDate?.toLocaleDateString('sr-RS') || 'Nepoznato'
  const startTime = survey.dailyStartTime || 'Nepoznato'
  const endTime = survey.dailyEndTime || 'Nepoznato'
  
  return `Recurring: ${startDate} - ${endDate}, ${startTime} - ${endTime}`
}
