'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Survey } from '@prisma/client'
import KioskPasswordPrompt from '@/components/KioskPasswordPrompt'

export default function KioskRedirectPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null)

  useEffect(() => {
    const redirectToKiosk = async () => {
      try {
        // Fetch the first active survey
        const response = await fetch('/api/surveys')
        if (response.ok) {
          const surveys: Survey[] = await response.json()
          
          // Find the first active survey
          const survey = surveys.find(survey => survey.isActive)
          
          if (survey) {
            setActiveSurvey(survey)
            setShowPasswordPrompt(true)
          } else {
            setError('No active surveys found')
          }
        } else {
          setError('Failed to fetch surveys')
        }
      } catch (err) {
        console.error('Error redirecting to kiosk:', err)
        setError('An error occurred while loading the survey')
      } finally {
        setIsLoading(false)
      }
    }

    redirectToKiosk()
  }, [router])

  const handlePasswordCorrect = () => {
    if (activeSurvey) {
      router.push(`/kiosk/${activeSurvey.id}`)
    }
  }


  if (showPasswordPrompt) {
    return (
      <KioskPasswordPrompt
        onPasswordCorrect={handlePasswordCorrect}
        onCancel={() => router.push('/')}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading kiosk mode...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Kiosk Mode Unavailable</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return null
}
