'use client'

import { useRouter } from 'next/navigation'
import { Home } from 'lucide-react'

interface HomeButtonProps {
  className?: string
}

export default function HomeButton({ className = '' }: HomeButtonProps) {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push('/')}
      className={`inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${className}`}
      title="Go to Admin Dashboard"
    >
      <Home className="h-4 w-4 mr-2" />
      Home
    </button>
  )
}
