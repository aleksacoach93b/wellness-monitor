'use client'

import { useState, useEffect } from 'react'
import { Download, Link, Copy, Check, X } from 'lucide-react'

interface CSVLinkModalProps {
  surveyId: string
  surveyTitle: string
}

export default function CSVLinkModal({ surveyId, surveyTitle }: CSVLinkModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const [csvUrl, setCsvUrl] = useState('')
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCsvUrl(`${window.location.origin}/api/surveys/${surveyId}/export/csv`)
    }
  }, [surveyId])
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(csvUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }
  
  const handleOpenLink = () => {
    window.open(csvUrl, '_blank')
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      >
        <Download className="h-4 w-4 mr-2" />
        CSV Link for Power BI
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  CSV Export Link
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Use this link to import data into Power BI:
                </p>
                <div className="bg-gray-50 p-3 rounded-md border">
                  <p className="text-sm font-mono text-gray-800 break-all">
                    {csvUrl}
                  </p>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleOpenLink}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <Link className="h-4 w-4 mr-2" />
                  Open Link
                </button>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <p className="text-xs text-blue-800">
                  <strong>Power BI Instructions:</strong><br />
                  1. Copy the link above<br />
                  2. In Power BI, go to "Get Data" → "Web"<br />
                  3. Paste the URL and click "OK"<br />
                  4. The data will be imported automatically
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
