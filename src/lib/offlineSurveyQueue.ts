/** Persist before sending. One storage key per request prevents concurrent queue rewrites losing data. */
export type SurveySubmissionPayload = {
  surveyId: string
  playerId?: string | null
  playerName?: string | null
  playerEmail?: string | null
  sessionType?: string | null
  matchDay?: string | null
  submissionId?: string
  clientCreatedAt?: string
  answers: { questionId: string; value: string }[]
}
export type SubmissionScope = { surveyId: string; playerId?: string | null }
export type QueuedSurveySubmission = {
  id: string
  createdAt: number
  payload: SurveySubmissionPayload
  state: 'pending' | 'attention'
  attempts: number
  nextAttemptAt: number
  error?: string
  questionId?: string
  legacyId?: string
}
type SavedSubmission = {
  id: string
  state: 'saved'
  surveyId: string
  playerId: string | null
  savedAt: number
}
export type StoredSubmission = QueuedSurveySubmission | SavedSubmission
const PREFIX = 'wm-survey-delivery-v2:',
  LEGACY = 'wellness-offline-survey-queue',
  EVENT = 'wm-survey-delivery-changed',
  MAX_QUEUE = 40
const memory = new Map<string, StoredSubmission>(),
  inFlight = new Map<string, Promise<void>>()
const matches = (item: StoredSubmission, scope: SubmissionScope) => {
  const s = item.state === 'saved' ? item : item.payload
  return (
    s.surveyId === scope.surveyId &&
    (scope.playerId === undefined || (s.playerId || null) === scope.playerId)
  )
}
function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}
function persist(item: StoredSubmission) {
  try {
    localStorage.setItem(PREFIX + item.id, JSON.stringify(item))
    memory.delete(item.id)
  } catch {
    memory.set(item.id, item)
  }
  notify()
}
function entries(): StoredSubmission[] {
  const values = new Map<string, StoredSubmission>()
  if (typeof window === 'undefined') return []
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(PREFIX)) continue
      try {
        const x = JSON.parse(localStorage.getItem(key) || 'null')
        if (
          !x ||
          x.id !== key.slice(PREFIX.length) ||
          !['pending', 'attention', 'saved'].includes(x.state)
        )
          continue
        if (x.state === 'saved' && Date.now() - x.savedAt > 48 * 3600_000) {
          localStorage.removeItem(key)
          continue
        }
        if (
          x.state === 'saved' ||
          (x.payload?.surveyId && Array.isArray(x.payload.answers))
        )
          values.set(x.id, x)
      } catch {
        /* Leave unreadable storage untouched. */
      }
    }
  } catch {
    /* Memory fallback keeps the current page usable. */
  }
  for (const [id, item] of memory) values.set(id, item)
  return [...values.values()]
}
function migrateLegacy() {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(LEGACY)
    if (!raw) return
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return
    // Store the assigned IDs in the legacy payload as well, so older open tabs use the same IDs.
    let changed = false
    for (const item of list) {
      if (!item?.payload?.surveyId || !Array.isArray(item.payload.answers))
        continue
      if (!item.payload.submissionId) {
        item.payload.submissionId = crypto.randomUUID()
        item.payload.clientCreatedAt = new Date(
          item.createdAt || Date.now(),
        ).toISOString()
        changed = true
      }
    }
    if (changed) localStorage.setItem(LEGACY, JSON.stringify(list))
    for (const item of list) {
      if (!item?.payload?.submissionId || !Array.isArray(item.payload.answers))
        return
      if (!entries().some((x) => x.id === item.payload.submissionId))
        persist({
          id: item.payload.submissionId,
          createdAt: item.createdAt || Date.now(),
          payload: item.payload,
          state: 'pending',
          attempts: 0,
          nextAttemptAt: 0,
          legacyId: item.id,
        })
      if (!localStorage.getItem(PREFIX + item.payload.submissionId)) return
    }
    localStorage.removeItem(LEGACY)
  } catch {
    /* Never discard old entries when storage is unavailable. */
  }
}
export function getSurveySubmissions(
  scope: SubmissionScope,
): QueuedSurveySubmission[] {
  migrateLegacy()
  return entries()
    .filter(
      (x): x is QueuedSurveySubmission =>
        x.state !== 'saved' && matches(x, scope),
    )
    .sort((a, b) => a.createdAt - b.createdAt)
}
export function getOfflineQueueCount(scope: SubmissionScope) {
  return getSurveySubmissions(scope).length
}
export function readSurveySubmission(id: string) {
  return entries().find((x) => x.id === id) || null
}
export function isSubmissionDurable(id: string) {
  try {
    return !memory.has(id) && !!localStorage.getItem(PREFIX + id)
  } catch {
    return false
  }
}
export function enqueueOfflineSurveySubmission(
  payload: SurveySubmissionPayload,
): QueuedSurveySubmission {
  const id = payload.submissionId || crypto.randomUUID(),
    existing = readSurveySubmission(id)
  if (existing?.state === 'saved')
    throw Error('This questionnaire was already submitted.')
  if (existing) return existing
  if (entries().filter((x) => x.state !== 'saved').length >= MAX_QUEUE)
    throw Error(
      'This device has too many unsent questionnaires. Keep this page open and retry when connected.',
    )
  const now = Date.now(),
    item: QueuedSurveySubmission = {
      id,
      createdAt: now,
      payload: {
        ...payload,
        answers: payload.answers.map((answer) => ({ ...answer })),
        submissionId: id,
        clientCreatedAt: payload.clientCreatedAt || new Date(now).toISOString(),
      },
      state: 'pending',
      attempts: 0,
      nextAttemptAt: 0,
    }
  persist(item)
  return item
}
/** Only a definitively rejected request can be edited/discarded; uncertain deliveries keep their identity. */
export function releaseRejectedSubmission(id: string) {
  const item = readSurveySubmission(id)
  if (item?.state !== 'attention') return false
  try {
    localStorage.removeItem(PREFIX + id)
  } catch {
    if (!memory.has(id)) return false
  }
  memory.delete(id)
  notify()
  return true
}
export function subscribeSurveyDelivery(listener: () => void) {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}
export function isLikelyNetworkFailure(
  error: unknown,
  response?: Response | null,
) {
  return (
    (typeof navigator !== 'undefined' && !navigator.onLine) ||
    (!!response &&
      (response.status === 0 ||
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500)) ||
    error instanceof TypeError ||
    (error instanceof Error &&
      /network|fetch|offline|load failed|timeout|abort/i.test(
        error.message + ' ' + error.name,
      ))
  )
}
async function deliver(item: QueuedSurveySubmission) {
  if (inFlight.has(item.id)) return inFlight.get(item.id)!
  const job = (async () => {
    const current = readSurveySubmission(item.id)
    if (!current || current.state === 'saved') return
    const attempted = { ...current, attempts: current.attempts + 1 }
    persist(attempted)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    try {
      const response = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(current.payload),
        signal: controller.signal,
      })
      const body = await response.json().catch(() => ({}))
      if (
        response.ok &&
        typeof body.id === 'string' &&
        body.surveyId === item.payload.surveyId
      ) {
        persist({
          id: item.id,
          state: 'saved',
          surveyId: item.payload.surveyId,
          playerId: item.payload.playerId || null,
          savedAt: Date.now(),
        })
        return
      }
      const transient = response.ok || isLikelyNetworkFailure(null, response)
      persist({
        ...attempted,
        state: transient ? 'pending' : 'attention',
        nextAttemptAt:
          Date.now() +
          Math.min(60000, 2000 * 2 ** Math.min(attempted.attempts, 5)),
        error:
          typeof body.error === 'string'
            ? body.error
            : `Unable to submit (HTTP ${response.status}).`,
        questionId:
          typeof body.focusQuestionId === 'string'
            ? body.focusQuestionId
            : typeof body.rhrQuestionId === 'string'
              ? body.rhrQuestionId
              : undefined,
      })
    } catch {
      persist({
        ...attempted,
        state: 'pending',
        nextAttemptAt:
          Date.now() +
          Math.min(60000, 2000 * 2 ** Math.min(attempted.attempts, 5)),
        error:
          'Connection interrupted. This questionnaire has not been confirmed by the server.',
      })
    } finally {
      clearTimeout(timeout)
    }
  })().finally(() => inFlight.delete(item.id))
  inFlight.set(item.id, job)
  return job
}
export type FlushResult = {
  synced: number
  remaining: number
  failed: number
  attention: number
}
export async function flushOfflineSurveyQueue(
  scope: SubmissionScope,
  forceId?: string | true,
): Promise<FlushResult> {
  const before = getSurveySubmissions(scope),
    ids = before.map((x) => x.id)
  if (typeof navigator === 'undefined' || navigator.onLine) {
    for (const item of before) {
      if (
        item.state === 'attention' ||
        (forceId !== true &&
          item.id !== forceId &&
          item.nextAttemptAt > Date.now())
      )
        continue
      await deliver(item)
    }
  }
  const remaining = getSurveySubmissions(scope)
  return {
    synced: ids.filter((id) => readSurveySubmission(id)?.state === 'saved')
      .length,
    remaining: remaining.length,
    failed: remaining.filter((x) => x.attempts > 0).length,
    attention: remaining.filter((x) => x.state === 'attention').length,
  }
}
