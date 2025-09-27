'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
  surveyId: string
}

export default function BackButton({ surveyId }: BackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    // Go back to kiosk page
    router.push(`/kiosk/${surveyId}`)
  }

  return (
    <button
      onClick={handleBack}
      className="absolute top-6 left-6 flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 group"
    >
      <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform duration-200" />
      <span className="text-sm font-medium">Back to Kiosk</span>
    </button>
  )
}
