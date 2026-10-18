import {
  pdfColumnBands, pdfRowPages, printTextColor, opsPdfFilename,
  type OpsPdfTheme, type OpsPdfPaper, type OpsPdfContent, type PdfColumn,
} from './opsPdfLayout'

export type OpsPdfContext = {
  team: string
  survey: string
  date: string
  filter: string
  search: string
  totalPlayers: number
}
type Options = {
  table: HTMLTableElement
  context: OpsPdfContext
  theme: OpsPdfTheme
  paper: OpsPdfPaper
  content: OpsPdfContent
  onProgress: (page: number, total: number) => void
}

function text(tag: string, value: string, className?: string) {
  const element = document.createElement(tag)
  element.textContent = value
  if (className) element.className = className
  return element
}

async function embedAvatars(table: HTMLTableElement) {
  const images = new Map<string, Promise<string | null>>()
  const readImage = async (url: string) => {
    try {
      const response = await fetch(url, {
        mode: 'cors', credentials: new URL(url, location.href).origin === location.origin ? 'same-origin' : 'omit',
        cache: 'force-cache', signal: AbortSignal.timeout(4000),
      })
      if (!response.ok) return null
      const blob = await response.blob()
      if (!blob.type.startsWith('image/') || blob.size > 8_000_000) return null
      return await new Promise<string | null>(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } catch { return null }
  }
  await Promise.all(Array.from(table.querySelectorAll('img')).map(async image => {
    const url = image.getAttribute('src') || ''
    if (!images.has(url)) images.set(url, readImage(url))
    const data = await images.get(url)
    if (data) {
      image.removeAttribute('srcset')
      image.loading = 'eager'
      image.src = data
      await image.decode().catch(() => {})
    } else {
      const name = image.closest('td')?.querySelector('.ops-cell-name')?.textContent || ''
      image.replaceWith(text('span', name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?'))
    }
  }))
}

function sectionTable(source: HTMLTableElement, indexes: number[], widths: number[], pageWidth: number) {
  const table = source.cloneNode(true) as HTMLTableElement
  table.style.width = `${pageWidth}px`
  table.style.tableLayout = 'fixed'
  const colgroup = document.createElement('colgroup')
  widths.forEach(width => {
    const col = document.createElement('col')
    col.style.width = `${width}px`
    colgroup.append(col)
  })
  table.prepend(colgroup)
  // Header groups follow their original spans, including custom metric groups.
  const group = table.tHead!.rows[0]
  let offset = 0
  for (const cell of Array.from(group.cells)) {
    const span = cell.colSpan
    const count = indexes.filter(i => i >= offset && i < offset + span).length
    if (count) cell.colSpan = count
    else cell.remove()
    offset += span
  }
  for (const row of [table.tHead!.rows[1], ...Array.from(table.tBodies[0].rows)]) {
    for (const [index, cell] of Array.from(row.cells).entries()) {
      if (!indexes.includes(index)) cell.remove()
    }
  }
  return table
}

/** A client-only snapshot of the actual rendered table; never requests or writes wellness data. */
export async function exportOpsPdf({ table: source, context, theme, paper, content, onProgress }: Options) {
  if (!source.tBodies[0]?.rows.length || !source.tHead?.rows[1]) {
    throw new Error('No table rows are available to export.')
  }
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'), import('jspdf'),
  ])
  await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 5000))])
  await embedAvatars(source)
  const host = document.createElement('div')
  host.className = 'ops-pdf-host'
  host.setAttribute('aria-hidden', 'true')
  host.inert = true
  const page = document.createElement('div')
  page.className = 'ops-pdf-capture'
  page.dataset.theme = theme
  host.append(page)
  document.body.append(host)
  try {
    const shell = document.createElement('div')
    shell.className = 'ops-classic-shell'
    shell.append(source)
    page.append(shell)
    source.style.width = 'max-content'
    const columns: PdfColumn[] = Array.from(source.tHead!.rows[1].cells).map(cell => ({
      id: cell.dataset.opsColumn || '',
      width: Math.ceil(Math.max(cell.getBoundingClientRect().width, 70)),
    }))
    for (const column of columns) column.width = Math.min(column.id === 'athlete' ? 340 : 320, column.width)
    const pageWidth = paper === 'a3' ? 1800 : 1200
    const bands = pdfColumnBands(columns, pageWidth, content)
    page.replaceChildren()
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: paper, compress: true })
    doc.setProperties({ title: `Live Ops - ${context.date}`, subject: `${content} / ${theme}`, creator: 'Wellness Monitor' })
    const margin = 24, pdfWidth = doc.internal.pageSize.getWidth() - margin * 2,
      pdfHeight = doc.internal.pageSize.getHeight() - margin * 2
    const plan: { table: HTMLTableElement; width: number; rows: number[]; band: number }[] = []
    const rowCount = source.tBodies[0].rows.length
    const header = document.createElement('header')
    header.className = 'ops-pdf-page-header'
    header.append(text('h1', context.team + ' | Live Ops'), text('p', context.survey))
    const date = /^\d{4}-\d{2}-\d{2}$/.test(context.date)
      ? context.date.split('-').reverse().join('.') : context.date
    header.append(text('p', `${date} | ${rowCount} of ${context.totalPlayers} players | ${context.filter}${context.search ? ' | Search: ' + context.search : ''}`))
    const footer = document.createElement('footer')
    footer.className = 'ops-pdf-page-footer'
    const stamp = new Date().toLocaleString()
    for (const [band, selected] of bands.entries()) {
      const indexes = selected.map(c => columns.findIndex(x => x.id === c.id))
      // Use one print scale even when the final column section is narrower.
      const width = pageWidth
      const section = sectionTable(source, indexes, selected.map(c => c.width), width)
      page.style.width = `${width}px`
      shell.replaceChildren(section)
      page.replaceChildren(header, shell, footer)
      // Reserve the complete footer, including page/row labels, before pagination.
      footer.textContent = `${content === 'table' ? 'Current table' : 'Daily summary'} | Section ${band + 1}/${bands.length} | Players ${rowCount}-${rowCount} | Page 999/999 | Exported ${stamp}`
      if (theme === 'light') {
        for (const element of Array.from(section.querySelectorAll<HTMLElement>('[style]'))) {
          if (element.style.color) element.style.color = printTextColor(getComputedStyle(element).color)
        }
      }
      const heights = Array.from(section.tBodies[0].rows).map(row => row.getBoundingClientRect().height)
      const reserve = header.offsetHeight + footer.offsetHeight + section.tHead!.getBoundingClientRect().height + 6
      const available = pdfHeight * width / pdfWidth - reserve
      for (const rows of pdfRowPages(heights, available)) plan.push({ table: section, width, rows, band })
    }
    for (const [index, part] of plan.entries()) {
      onProgress(index + 1, plan.length)
      const table = part.table.cloneNode(true) as HTMLTableElement
      for (const [row, element] of Array.from(table.tBodies[0].rows).entries()) if (!part.rows.includes(row)) element.remove()
      page.style.width = `${part.width}px`
      shell.replaceChildren(table)
      page.replaceChildren(header, shell, footer)
      footer.textContent = `${content === 'table' ? 'Current table' : 'Daily summary'} | Section ${part.band + 1}/${bands.length} | Players ${part.rows[0] + 1}-${part.rows.at(-1)! + 1} | Page ${index + 1}/${plan.length} | Exported ${stamp}`
      const height = Math.ceil(page.getBoundingClientRect().height)
      const scale = Math.min(2, 4096 / Math.max(part.width, height), Math.sqrt(4_000_000 / (part.width * height)))
      const canvas = await html2canvas(page, {
        scale, backgroundColor: theme === 'dark' ? '#071426' : '#ffffff',
        useCORS: true, imageTimeout: 4000, logging: false,
        windowWidth: Math.max(1800, part.width), scrollX: 0, scrollY: 0,
      })
      const renderedHeight = canvas.height / canvas.width * pdfWidth
      if (renderedHeight > pdfHeight + 1) throw new Error('The table does not fit this page. Choose A3 or fewer columns.')
      if (index) doc.addPage()
      if (theme === 'dark') { doc.setFillColor('#071426'); doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F') }
      doc.addImage(canvas, 'PNG', margin, margin, pdfWidth, renderedHeight, undefined, 'FAST')
      canvas.width = canvas.height = 0
    }
    await doc.save(opsPdfFilename(context.date, theme, content), { returnPromise: true })
  } finally { host.remove() }
}
