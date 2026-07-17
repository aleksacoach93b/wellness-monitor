const STORAGE_PREFIX = 'kiosk-recent-players'
const MAX_RECENT = 8

export function recentPlayersStorageKey(surveyId: string): string {
  return `${STORAGE_PREFIX}:${surveyId}`
}

export function readRecentPlayerIds(surveyId: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(recentPlayersStorageKey(surveyId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

export function pushRecentPlayerId(surveyId: string, playerId: string): void {
  if (typeof window === 'undefined' || !playerId) return
  try {
    const prev = readRecentPlayerIds(surveyId).filter((id) => id !== playerId)
    const next = [playerId, ...prev].slice(0, MAX_RECENT)
    localStorage.setItem(recentPlayersStorageKey(surveyId), JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
}
