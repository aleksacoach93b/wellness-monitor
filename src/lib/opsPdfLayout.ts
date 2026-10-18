export type OpsPdfTheme = 'dark' | 'light'
export type OpsPdfPaper = 'a4' | 'a3'
export type OpsPdfContent = 'table' | 'summary'
export type PdfColumn = { id: string; width: number }

const SUMMARY_COLUMNS = new Set([
  'athlete', 'performance', 'submitted', 'duration', 'quality', 'fatigue',
  'soreness', 'mood', 'stress', 'readiness', 'focus', 'rhr',
])

/** Repeat identity on each horizontal section; retain the displayed column order. */
export function pdfColumnBands(columns: PdfColumn[], maxWidth: number, content: OpsPdfContent) {
  const selected = columns.filter(c => content === 'table' || SUMMARY_COLUMNS.has(c.id))
  const identity = selected.find(c => c.id === 'athlete')
  if (!identity) throw new Error('The athlete column is required for PDF export.')
  const bands: PdfColumn[][] = []
  let band = [identity], width = identity.width
  for (const column of selected.filter(c => c !== identity)) {
    if (band.length > 1 && width + column.width > maxWidth) {
      bands.push(band)
      band = [identity]
      width = identity.width
    }
    band.push(column)
    width += column.width
  }
  bands.push(band)
  return bands
}

/** Never cut a player's row between pages. */
export function pdfRowPages(heights: number[], availableHeight: number) {
  const pages: number[][] = []
  let page: number[] = [], height = 0
  for (let index = 0; index < heights.length; index++) {
    if (heights[index] > availableHeight) {
      throw new Error('A table row is too tall for this page. Choose A3 or fewer columns.')
    }
    if (page.length && height + heights[index] > availableHeight) {
      pages.push(page)
      page = []
      height = 0
    }
    page.push(index)
    height += heights[index]
  }
  if (page.length) pages.push(page)
  return pages
}

/** Darken text colours against paper while retaining their status hue. */
export function printTextColor(color: string) {
  const rgb = color.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/i)
  if (!rgb) return '#243447'
  const channels = rgb.slice(1, 4).map(Number)
  const luminance = (values: number[]) => values.map(v => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
  while (1.05 / (luminance(channels) + 0.05) < 4.55) {
    for (let i = 0; i < 3; i++) channels[i] *= 0.9
  }
  return `rgb(${channels.map(Math.round).join(', ')})`
}

export function opsPdfTitle(date: string) {
  const clean = date.replace(/[^\d-]/g, '')
  const label = /^\d{4}-\d{2}-\d{2}$/.test(clean)
    ? clean.split('-').reverse().join('.') : clean
  return `Daily Wellness Report - ${label}`
}

export function opsPdfFilename(date: string) {
  return `${opsPdfTitle(date)}.pdf`
}
