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
      className={`inline-flex items-center rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${className}`}
      title="Go to Admin Dashboard"
    >
      <Home className="h-4 w-4 mr-2" />
      Home
    </button>
  )
}
