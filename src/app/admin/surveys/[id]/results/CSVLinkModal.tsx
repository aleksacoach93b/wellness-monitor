'use client'

import { useState, useEffect } from 'react'
import { Download, Link, Copy, Check, X } from 'lucide-react'

interface CSVLinkModalProps {
  surveyId: string
  surveyTitle: string
}

export default function CSVLinkModal({ surveyId }: CSVLinkModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState<'main' | 'legacy' | null>(null)
  const [csvUrl, setCsvUrl] = useState('')
  const [legacyCsvUrl, setLegacyCsvUrl] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const base = `${window.location.origin}/api/surveys/${surveyId}/export/csv`
      setCsvUrl(base)
      setLegacyCsvUrl(`${base}?legacy=1`)
    }
  }, [surveyId])

  const handleCopyLink = async (url: string, which: 'main' | 'legacy') => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(which)
      setTimeout(() => setCopied(null), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank')
  }

  return (
    <>
      <button
        type="button"
        title="CSV export link for Power BI"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/90 bg-emerald-50/90 px-3 py-1.5 text-xs font-medium text-emerald-900 shadow-sm transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
      >
        <Download className="h-4 w-4 shrink-0 text-emerald-700" />
        CSV (Power BI)
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 h-full w-full overflow-y-auto bg-gray-600 bg-opacity-50">
          <div className="relative top-16 mx-auto w-[28rem] max-w-[95vw] rounded-md border bg-white p-5 shadow-lg">
            <div className="mt-1">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">CSV Export Link</h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4">
                <p className="mb-1 text-sm font-medium text-gray-900">Main link (use this)</p>
                <p className="mb-2 text-xs text-gray-600">
                  Same URL as before. Includes intensity numbers plus Exact spot and When text
                  columns (blank for older responses).
                </p>
                <div className="rounded-md border bg-gray-50 p-3">
                  <p className="break-all font-mono text-sm text-gray-800">{csvUrl}</p>
                </div>
                <div className="mt-3 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(csvUrl, 'main')}
                    className="inline-flex flex-1 items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {copied === 'main' ? (
                      <>
                        <Check className="mr-2 h-4 w-4 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Link
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenLink(csvUrl)}
                    className="inline-flex flex-1 items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <Link className="mr-2 h-4 w-4" />
                    Open Link
                  </button>
                </div>
              </div>

              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50/80 p-3">
                <p className="mb-1 text-sm font-medium text-amber-950">
                  Backup — legacy (intensity only)
                </p>
                <p className="mb-2 text-xs text-amber-900/80">
                  Old column shape without Exact spot / When. Use only if you need to roll back
                  Power BI to the previous schema.
                </p>
                <div className="rounded-md border border-amber-200/80 bg-white/80 p-2">
                  <p className="break-all font-mono text-xs text-gray-800">{legacyCsvUrl}</p>
                </div>
                <div className="mt-2 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(legacyCsvUrl, 'legacy')}
                    className="inline-flex flex-1 items-center justify-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-50"
                  >
                    {copied === 'legacy' ? 'Copied!' : 'Copy legacy link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenLink(legacyCsvUrl)}
                    className="inline-flex flex-1 items-center justify-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-50"
                  >
                    Open legacy
                  </button>
                </div>
              </div>

              <div className="rounded-md bg-blue-50 p-3">
                <p className="text-xs text-blue-800">
                  <strong>Power BI Instructions:</strong>
                  <br />
                  1. Copy the main link above
                  <br />
                  2. In Power BI, go to &quot;Get Data&quot; → &quot;Web&quot;
                  <br />
                  3. Paste the URL and click &quot;OK&quot;
                  <br />
                  4. Refresh later to pick up Exact spot / When text on new submissions
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
