'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, Copy, Check, X, FileSpreadsheet } from 'lucide-react'

interface CSVLinkModalProps { surveyId: string; surveyTitle: string }

export default function CSVLinkModal({ surveyId, surveyTitle }: CSVLinkModalProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [csvUrl, setCsvUrl] = useState('')
  useEffect(() => { setCsvUrl(`${window.location.origin}/api/surveys/${surveyId}/export/csv`) }, [surveyId])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(csvUrl)
      setCopied(true); setCopyError('')
      setTimeout(() => setCopied(false), 2000)
    } catch { setCopyError('Copy unavailable. Select and copy the link above.') }
  }
  return <>
    <button type="button" onClick={() => dialog.current?.showModal()} className="admin-btn admin-btn-ghost inline-flex items-center gap-2 text-sm" title="Unified wellness and Focus CSV for Power BI">
      <FileSpreadsheet className="h-4 w-4" />CSV (Power BI)
    </button>
    <dialog ref={dialog} aria-labelledby={`csv-title-${surveyId}`} className="m-auto max-h-[90dvh] w-[36rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60" onClick={e => { if (e.target === dialog.current) dialog.current.close() }}>
      <div className="space-y-5 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-widest text-teal-700">{surveyTitle}</p><h2 id={`csv-title-${surveyId}`} className="mt-2 text-xl font-bold">Wellness + Focus export</h2><p className="mt-1 text-sm text-slate-500">One submitted wellness response per row.</p></div>
          <button type="button" aria-label="Close CSV export" onClick={() => dialog.current?.close()} className="rounded-xl bg-slate-100 p-2 hover:bg-slate-200"><X className="h-5 w-5" /></button>
        </div>
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-bold text-teal-900">Permanent CSV link · Power BI</p>
          <p className="mt-1 text-xs text-teal-800">Use this same link for the complete survey, including Focus. Refresh your data source to load new submissions.</p>
          <input aria-label="Permanent CSV link" readOnly value={csvUrl} onFocus={e => e.target.select()} className="mt-3 w-full rounded-xl border border-teal-200 bg-white p-3 font-mono text-xs text-slate-800" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-teal-300 bg-white px-4 text-sm font-semibold text-teal-900">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied!' : 'Copy link'}</button>
            <a href={csvUrl} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"><Download className="h-4 w-4" />Download CSV</a>
          </div>
          <p role="status" className="mt-2 text-xs text-teal-900">{copyError || (copied ? 'Link copied to clipboard.' : '')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4"><h3 className="text-sm font-bold">Wellness & body map</h3><p className="mt-1 text-xs leading-relaxed text-slate-600">Player, submission, questionnaire answers, body areas, intensity, exact spot and when. Player ID and response ID support reliable joins.</p></div>
          <div className="rounded-2xl border border-slate-200 p-4"><h3 className="text-sm font-bold">Focus results & context</h3><p className="mt-1 text-xs leading-relaxed text-slate-600">Median RT (ms), responses, early taps, response speed (1/s), exploratory slow responses, quality flags, position, caffeine and minutes since waking.</p></div>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">Focus comes from the completed attempt attached to that response. Older or unanswered Focus fields stay blank; zero means a measured zero. Practice, unfinished attempts and the isolated demo do not become wellness results. Test date follows the survey timezone; timestamp columns marked UTC use UTC.</p>
        <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600"><strong>Power BI:</strong> Get Data → Web → paste the permanent link. On an existing query, include the added columns in your column selection and set numeric types. Caffeine is 0 = no, 1 = yes. Slow responses ≥355 ms are exploratory, not a fatigue classification.</p>
        <details className="text-xs text-slate-500"><summary className="cursor-pointer font-semibold">Legacy body-map layout</summary><p className="mt-2">This version omits Exact spot / When columns. Focus columns remain included.</p><a href={`${csvUrl}?legacy=1`} className="mt-2 inline-block text-teal-700 underline">Download legacy layout</a></details>
      </div>
    </dialog>
  </>
}
