export type QueuedSurveySubmission = {
  id: string
  createdAt: number
  payload: {
    surveyId: string
    playerId?: string | null
    playerName?: string | null
    playerEmail?: string | null
    sessionType?: string | null
    matchDay?: string | null
    answers: Array<{ questionId: string; value: string }>
  }
}

const STORAGE_KEY = 'wellness-offline-survey-queue'
const MAX_QUEUE = 40

function readQueue(): QueuedSurveySubmission[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is QueuedSurveySubmission =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as QueuedSurveySubmission).id === 'string' &&
        typeof (item as QueuedSurveySubmission).createdAt === 'number' &&
        Boolean((item as QueuedSurveySubmission).payload?.surveyId)
    )
  } catch {
    return []
  }
}

function writeQueue(items: QueuedSurveySubmission[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_QUEUE)))
  } catch {
    /* ignore quota / private mode */
  }
}

export function getOfflineQueueCount(): number {
  return readQueue().length
}

export function enqueueOfflineSurveySubmission(
  payload: QueuedSurveySubmission['payload']
): QueuedSurveySubmission {
  const item: QueuedSurveySubmission = {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
    payload,
  }
  const next = [item, ...readQueue()].slice(0, MAX_QUEUE)
  writeQueue(next)
  return item
}

export function isLikelyNetworkFailure(error: unknown, response?: Response | null): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (response && (response.status === 0 || response.status >= 500)) return true
  if (error instanceof TypeError) return true
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('load failed') ||
      msg.includes('offline')
    )
  }
  return false
}

export type FlushResult = {
  synced: number
  remaining: number
  failed: number
}

/** Attempt to POST every queued submission. Removes only successful ones. */
export async function flushOfflineSurveyQueue(): Promise<FlushResult> {
  const queue = readQueue()
  if (queue.length === 0) {
    return { synced: 0, remaining: 0, failed: 0 }
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { synced: 0, remaining: queue.length, failed: 0 }
  }

  const remaining: QueuedSurveySubmission[] = []
  let synced = 0
  let failed = 0

  // Oldest first so earlier answers land first
  const ordered = [...queue].sort((a, b) => a.createdAt - b.createdAt)

  for (const item of ordered) {
    try {
      const response = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      })
      if (response.ok) {
        synced += 1
      } else if (response.status >= 400 && response.status < 500 && response.status !== 408) {
        // Drop permanent client errors so a bad payload cannot block the queue forever
        failed += 1
      } else {
        remaining.push(item)
        failed += 1
      }
    } catch {
      remaining.push(item)
      failed += 1
    }
  }

  writeQueue(remaining)
  return { synced, remaining: remaining.length, failed }
}
