'use client'

import { useState, useEffect } from 'react'
import { BarChart3, ExternalLink, Settings, Download } from 'lucide-react'

interface PowerBILinkProps {
  surveyId: string
  surveyTitle: string
}

interface PowerBIConfig {
  directUrl?: string
  embedUrl?: string
  csvExportUrl: string
  jsonExportUrl: string
  survey: {
    id: string
    title: string
  }
  message?: string
  setup?: {
    instructions: string
    steps: string[]
    exportOptions: {
      csv: string
      json: string
    }
  }
}

export default function PowerBILink({ surveyId, surveyTitle }: PowerBILinkProps) {
  const [config, setConfig] = useState<PowerBIConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPowerBIConfig = async () => {
      try {
        const response = await fetch(`/api/surveys/${surveyId}/powerbi`)
        if (response.ok) {
          const data = await response.json()
          setConfig(data)
        } else {
          setError('Failed to load Power BI configuration')
        }
      } catch (err) {
        setError('Error loading Power BI configuration')
      } finally {
        setLoading(false)
      }
    }

    fetchPowerBIConfig()
  }, [surveyId])

  if (loading) {
    return (
      <div className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-400">
        <BarChart3 className="h-4 w-4 mr-2 animate-pulse" />
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600">
        <Settings className="h-4 w-4 mr-2" />
        Setup Required
      </div>
    )
  }

  if (!config) {
    return null
  }

  // If Power BI is configured, show the link
  if (config.directUrl || config.embedUrl) {
    const powerBiUrl = config.directUrl || config.embedUrl
    
    return (
      <a
        href={powerBiUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
      >
        <BarChart3 className="h-4 w-4 mr-2" />
        Power BI
        <ExternalLink className="h-3 w-3 ml-1" />
      </a>
    )
  }

  // If not configured, show setup options
  return (
    <div className="inline-flex items-center space-x-2">
      <a
        href={`/api/surveys/${surveyId}/export/powerbi`}
        download={`${surveyTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_powerbi.json`}
        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
      >
        <Download className="h-4 w-4 mr-2" />
        Export JSON
      </a>
      <a
        href="/admin/powerbi"
        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
      >
        <Settings className="h-4 w-4 mr-2" />
        Setup Power BI
      </a>
    </div>
  )
}
