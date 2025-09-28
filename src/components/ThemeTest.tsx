'use client'

import { useTheme } from '@/contexts/ThemeContext'

export default function ThemeTest() {
  const { theme, mounted } = useTheme()

  if (!mounted) {
    return <div>Loading theme...</div>
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs">
      Current theme: {theme}
    </div>
  )
}
