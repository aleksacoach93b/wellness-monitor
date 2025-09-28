'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ShortKioskRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the main kiosk page
    router.push('/kiosk')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-300">Redirecting to kiosk mode...</p>
      </div>
    </div>
  )
}
