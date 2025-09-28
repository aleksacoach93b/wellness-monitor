'use client'

import { useState } from 'react'
import { Database } from 'lucide-react'

interface GoogleSheetsExportButtonProps {
  surveyId: string
}

export default function GoogleSheetsExportButton({ surveyId }: GoogleSheetsExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleExport = async () => {
    setIsExporting(true)
    setExportStatus('idle')

    try {
      const response = await fetch('/api/google-sheets/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveyId })
      })

      if (response.ok) {
        const result = await response.json()
        setExportStatus('success')
        alert(`Successfully exported ${result.uploadedCount} responses to Google Sheets!`)
      } else {
        setExportStatus('error')
        alert('Failed to export to Google Sheets. Please check your configuration.')
      }
    } catch (error) {
      console.error('Export error:', error)
      setExportStatus('error')
      alert('Failed to export to Google Sheets. Please check your configuration.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
        exportStatus === 'success' 
          ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
          : exportStatus === 'error'
          ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
          : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
      }`}
    >
      <Database className="h-4 w-4 mr-2" />
      {isExporting ? 'Exporting...' : 'Export to Google Sheets'}
    </button>
  )
}
