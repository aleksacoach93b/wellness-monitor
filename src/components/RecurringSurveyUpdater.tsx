'use client'

import { useEffect } from 'react'

export default function RecurringSurveyUpdater() {
  useEffect(() => {
    // Update recurring surveys every minute
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/surveys/update-recurring', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const result = await response.json()
          if (result.updates && result.updates.length > 0) {
            console.log('Updated recurring surveys:', result.updates)
            // Optionally show a toast notification
          }
        }
      } catch (error) {
        console.error('Error updating recurring surveys:', error)
      }
    }, 60000) // Check every minute

    // Also run immediately on mount
    const updateSurveys = async () => {
      try {
        await fetch('/api/surveys/update-recurring', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      } catch (error) {
        console.error('Error updating recurring surveys on mount:', error)
      }
    }

    updateSurveys()

    return () => clearInterval(interval)
  }, [])

  return null // This component doesn't render anything
}
