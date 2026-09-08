/** Optional club identity color (hex) used as kiosk accent without changing theme tokens. */

const HEX = /^#([0-9A-Fa-f]{6})$/

export function normalizeClubColor(raw?: string | null): string | null {
  const value = raw?.trim()
  if (!value) return null
  return HEX.test(value) ? value.toUpperCase() : null
}

export function clubOnColor(hex: string): '#FFFFFF' | '#0F172A' {
  const n = hex.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#0F172A' : '#FFFFFF'
}
