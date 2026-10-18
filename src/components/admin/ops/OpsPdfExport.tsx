'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Download, FileDown, Loader2, Moon, Sun, X } from 'lucide-react'
import type { OpsPdfContext } from '@/lib/opsPdfExport'
import type { OpsPdfTheme, OpsPdfPaper, OpsPdfContent } from '@/lib/opsPdfLayout'
import './ops-pdf.css'

export default function OpsPdfExport({ getTable, context, disabled }: {
  getTable: () => HTMLTableElement | null
  context: OpsPdfContext
  disabled: boolean
}) {
  const id = useId(), dialog = useRef<HTMLDialogElement>(null), launch = useRef<HTMLButtonElement>(null)
  const inFlight = useRef(false)
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState<OpsPdfTheme>('light')
  const [paper, setPaper] = useState<OpsPdfPaper>('a3')
  const [content, setContent] = useState<OpsPdfContent>('table')
  const [error, setError] = useState(''), [progress, setProgress] = useState('')
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
  }, [open])
  const close = () => {
    if (inFlight.current) return
    dialog.current?.close()
    setOpen(false)
    launch.current?.focus()
  }
  const download = async () => {
    if (inFlight.current || disabled) return
    const table = getTable()
    if (!table) { setError('The table is not ready. Close this window and try again.'); return }
    // Freeze the visible data before loading the PDF libraries or any auto-refresh.
    const snapshot = table.cloneNode(true) as HTMLTableElement
    const metadata = { ...context }
    inFlight.current = true
    setBusy(true)
    setError('')
    setProgress('Preparing PDF')
    try {
      const { exportOpsPdf } = await import('@/lib/opsPdfExport')
      await exportOpsPdf({
        table: snapshot, context: metadata, theme, paper, content,
        onProgress: (page, total) => setProgress(`Creating page ${page} of ${total}`),
      })
      inFlight.current = false
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to export PDF. Please try again.')
    } finally {
      inFlight.current = false
      setBusy(false)
      setProgress('')
    }
  }
  return <>
    <button ref={launch} type="button" className="admin-btn admin-btn-ghost ops-pdf-launch" aria-haspopup="dialog" disabled={disabled} title={disabled ? 'No players available to export' : 'Export the displayed daily table'} onClick={() => { setError(''); setOpen(true) }}>
      <FileDown size={16} />Export PDF
    </button>
    <dialog ref={dialog} className="ops-pdf-dialog" aria-labelledby={id + '-title'} aria-busy={busy} onCancel={e => { e.preventDefault(); close() }}>
      <header><div><p>LIVE OPS</p><h2 id={id + '-title'}>Export PDF</h2></div><button type="button" aria-label="Close PDF export" disabled={busy} onClick={close}><X size={20} /></button></header>
      <div className="ops-pdf-options">
        <p className="ops-pdf-context">{context.survey} · {context.date}</p>
        <fieldset disabled={busy}>
          <legend>Report</legend>
          <label className="ops-pdf-option"><input type="radio" name={id + '-content'} checked={content === 'table'} onChange={() => setContent('table')} /><span><strong>Current table</strong><small>All visible columns, including custom metrics</small></span></label>
          <label className="ops-pdf-option"><input type="radio" name={id + '-content'} checked={content === 'summary'} onChange={() => setContent('summary')} /><span><strong>Daily summary</strong><small>Key wellness, Focus and RHR columns from this table</small></span></label>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Appearance</legend>
          <div className="ops-pdf-theme-options">
            <label className="ops-pdf-option"><input type="radio" name={id + '-theme'} checked={theme === 'dark'} onChange={() => setTheme('dark')} /><Moon size={19} /><span><strong>Dark</strong><small>Same style as Live Ops</small></span></label>
            <label className="ops-pdf-option"><input type="radio" name={id + '-theme'} checked={theme === 'light'} onChange={() => setTheme('light')} /><Sun size={19} /><span><strong>Light</strong><small>White background for printing</small></span></label>
          </div>
        </fieldset>
        <label className="ops-pdf-paper">Paper size<select disabled={busy} value={paper} onChange={e => setPaper(e.target.value as OpsPdfPaper)}><option value="a4">A4 landscape</option><option value="a3">A3 landscape - wider table</option></select></label>
        <p className="ops-pdf-note">Uses the displayed players, filters and table order. Wide tables continue in sections with player names and headers repeated.</p>
        {error && <p role="alert" className="ops-pdf-error">{error}</p>}
        {busy && <p role="status" className="ops-pdf-progress"><Loader2 size={16} className="animate-spin" />{progress}</p>}
      </div>
      <footer><button type="button" className="admin-btn admin-btn-ghost" disabled={busy} onClick={close}>Cancel</button><button type="button" className="admin-btn admin-btn-primary" disabled={busy || disabled} onClick={() => void download()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Download PDF</button></footer>
    </dialog>
  </>
}
