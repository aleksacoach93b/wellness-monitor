import { parseRhrAnswer, isRhrQuestion } from './rhr/options'
import { parsePvtAnswer } from './pvt/options'
import { measurementEnvironment } from './measurementEnvironment'
import { recentDays, shiftDay, zonedDay } from './opsDates'
export type InsightPlayer = { id: string; firstName: string; lastName: string }
export type InsightResponse = {
  id: string
  playerId: string | null
  submittedAt: Date
  answers: {
    questionId: string
    value: string
    question: {
      id?: string
      text: string
      type: string
      options?: string | null
    }
  }[]
}
export type InsightFocus = {
  id: string
  responseId: string | null
  playerId: string
  questionId: string | null
  localDate: string
  startedAt: Date
  finishedAt: Date | null
  status: string
  practice: boolean
  durationSeconds: number
  protocolVersion: string
  deviceId: string
  userAgent: string
  context: unknown
  summary: unknown
}
export type InsightHr = {
  id: string
  playerId: string
  questionId: string
  localDate: string
  startedAt: Date
  finishedAt: Date | null
  status: string
  source: string
  position: string | null
  protocolVersion: string
  acquisitionVersion: string | null
  platform: string
  browser: string
  reason: string | null
  bpm: number | null
  fps: number | null
}
export type MeasurementItem = {
  questionId: string
  label: string
  status: string
  value: number | null
  unit: string
  context: string
  linked: boolean
  quality?: string
  note?: string
}
export type MeasurementState = {
  assigned: number
  completed: number
  submitted: number
  review: boolean
  state:
    | 'unavailable'
    | 'not-assigned'
    | 'pending'
    | 'in-progress'
    | 'repeat'
    | 'awaiting-submission'
    | 'saved'
  items: MeasurementItem[]
}
export type ReliabilityAttempt = {
  id: string
  playerId: string
  test: 'HR' | 'Focus'
  startedAt: Date
  status: string
  platform: string
  browser: string
  reason: string | null
  review: boolean
  source: string
}
export type ReliabilityGroup = {
  key: string
  test: 'HR' | 'Focus'
  platform: string
  browser: string
  total: number
  accepted: number
  repeat: number
  cameraErrors: number
  interrupted: number
  unfinished: number
  inProgress: number
  review: number
  rate: number | null
  reasons: { reason: string; count: number }[]
  firstSeen: string
  lastSeen: string
}
export type WeeklyMetric = {
  label: string
  median: number
  days: number
  previousMedian: number | null
  delta: number | null
  previousDays: number
  unit: 'ms' | 'bpm'
}
export type OpsInsights = ReturnType<typeof buildOpsInsights>
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
const number = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v : null
const median = (values: number[]) => {
  const v = [...values].sort((a, b) => a - b)
  return v.length
    ? (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2
    : null
}
const mean = (v: number[]) =>
  v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
export function aggregateReliability(
  attempts: ReliabilityAttempt[],
  now: Date,
) {
  const groups = new Map<
    string,
    ReliabilityGroup & { counts: Map<string, number> }
  >()
  for (const a of attempts) {
    const key = [a.test, a.platform, a.browser].join('|')
    let g = groups.get(key)
    if (!g) {
      g = {
        key,
        test: a.test,
        platform: a.platform,
        browser: a.browser,
        total: 0,
        accepted: 0,
        repeat: 0,
        cameraErrors: 0,
        interrupted: 0,
        unfinished: 0,
        inProgress: 0,
        review: 0,
        rate: null,
        reasons: [],
        firstSeen: a.startedAt.toISOString(),
        lastSeen: a.startedAt.toISOString(),
        counts: new Map(),
      }
      groups.set(key, g)
    }
    g.total++
    if (a.status === 'ACCEPTED' || a.status === 'COMPLETED') g.accepted++
    else if (a.status === 'REPEAT' || a.status === 'INVALID') g.repeat++
    else if (a.status === 'CAMERA_ERROR') g.cameraErrors++
    else if (a.status === 'INTERRUPTED') g.interrupted++
    else if (
      a.status === 'STARTED' &&
      now.getTime() - a.startedAt.getTime() < 15 * 60000
    )
      g.inProgress++
    else g.unfinished++
    if (a.review) g.review++
    if (a.reason) g.counts.set(a.reason, (g.counts.get(a.reason) || 0) + 1)
    const t = a.startedAt.toISOString()
    if (t < g.firstSeen) g.firstSeen = t
    if (t > g.lastSeen) g.lastSeen = t
  }
  return [...groups.values()]
    .map(({ counts, ...g }) => ({
      ...g,
      rate:
        g.total - g.inProgress > 0
          ? (100 * g.accepted) / (g.total - g.inProgress)
          : null,
      reasons: [...counts]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.total - a.total)
}
function state(items: MeasurementItem[]): MeasurementState {
  const completed = items.filter(
    (i) => i.status === 'ACCEPTED' || i.status === 'COMPLETED',
  ).length
  const submitted = items.filter((i) => i.linked).length
  return {
    assigned: items.length,
    completed,
    submitted,
    review: items.some(
      (i) =>
        i.quality === 'REVIEW' ||
        [
          'REPEAT',
          'INVALID',
          'CAMERA_ERROR',
          'INTERRUPTED',
          'INCOMPLETE',
          'REVIEW',
        ].includes(i.status),
    ),
    state: !items.length
      ? 'not-assigned'
      : submitted === items.length
        ? 'saved'
        : completed === items.length
          ? 'awaiting-submission'
          : items.some((i) =>
                [
                  'REPEAT',
                  'INVALID',
                  'CAMERA_ERROR',
                  'INTERRUPTED',
                  'INCOMPLETE',
                ].includes(i.status),
              )
            ? 'repeat'
            : items.some((i) => i.status === 'STARTED')
              ? 'in-progress'
              : 'pending',
    items,
  }
}
type MetricSample = {
  day: string
  key: string
  label: string
  value: number
  unit: 'ms' | 'bpm'
}
function metricGroups(
  samples: MetricSample[],
  start: string,
  end: string,
): WeeklyMetric[] {
  const grouped = new Map<string, MetricSample[]>()
  for (const s of samples) {
    const g = grouped.get(s.key) || []
    g.push(s)
    grouped.set(s.key, g)
  }
  return [...grouped.values()]
    .flatMap((g) => {
      const unique = (rows: MetricSample[]) => [
        ...new Map(rows.map((s) => [s.day, s.value])).values(),
      ]
      const cur = unique(g.filter((s) => s.day >= start && s.day <= end)),
        prev = unique(
          g.filter((s) => s.day < start && s.day >= shiftDay(start, -7)),
        )
      const current = median(cur),
        previous = median(prev)
      return current === null
        ? []
        : [
            {
              label: g[0].label,
              median: current,
              days: cur.length,
              previousMedian: previous,
              delta:
                cur.length >= 3 && prev.length >= 3 && previous !== null
                  ? current - previous
                  : null,
              previousDays: prev.length,
              unit: g[0].unit,
            },
          ]
    })
    .sort((a, b) => b.days - a.days)
    .map((m, i, all) => ({
      ...m,
      label:
        all.filter((x) => x.label === m.label).length > 1
          ? `${m.label} · context ${i + 1}`
          : m.label,
    }))
}
export function buildOpsInsights(args: {
  players: InsightPlayer[]
  questions: {
    id: string
    text: string
    type: string
    options?: string | null
    createdAt?: Date
  }[]
  responses: InsightResponse[]
  focus: InsightFocus[]
  hr: InsightHr[]
  date: string
  timezone: string
  now: Date
  hrTrackingAvailable: boolean
  focusAvailable: boolean
  wellnessDays: Record<
    string,
    {
      players: {
        id: string
        wellness: { readiness: number | null; statusText: string } | null
        status: string
      }[]
    }
  >
}) {
  const { players, questions, date, timezone, now } = args,
    start = shiftDay(date, -6),
    previousStart = shiftDay(date, -13),
    dates = recentDays(date)
  const active = new Set(players.map((p) => p.id))
  const responses = [...args.responses]
    .filter((r) => r.playerId && active.has(r.playerId))
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
  const latest = new Map<string, InsightResponse>()
  for (const r of responses) {
    const day = zonedDay(r.submittedAt, timezone)
    const key = `${r.playerId}|${day}`
    if (!latest.has(key)) latest.set(key, r)
  }
  const focus = args.focus.filter((s) => active.has(s.playerId) && !s.practice),
    hr = args.hr.filter((s) => active.has(s.playerId))
  const focusById = new Map(focus.map((s) => [s.id, s]))
  const fQuestions = questions.filter((q) => q.type === 'PVT'),
    hQuestions = questions.filter(isRhrQuestion)
  const linkedFocus = (r: InsightResponse | undefined, qid: string) => {
    const answer = r?.answers.find((a) => a.questionId === qid),
      receipt = answer ? parsePvtAnswer(answer.value) : null,
      s = receipt ? focusById.get(receipt.attemptId) : null
    return s &&
      s.playerId === r?.playerId &&
      s.responseId === r.id &&
      s.questionId === qid &&
      s.status === 'COMPLETED' &&
      !obj(s.summary).repeatRequired
      ? s
      : null
  }
  const today = players.map((p) => {
    const r = latest.get(`${p.id}|${date}`)
    const f = state(
      fQuestions
        .filter((q) => !q.createdAt || zonedDay(q.createdAt, timezone) <= date)
        .map((q) => {
          const linked = linkedFocus(r, q.id),
            attempts = focus
              .filter(
                (s) =>
                  s.playerId === p.id &&
                  s.questionId === q.id &&
                  s.localDate === date,
              )
              .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
          const chosen =
              linked ||
              attempts.find(
                (s) =>
                  s.status === 'COMPLETED' && !obj(s.summary).repeatRequired,
              ) ||
              attempts.at(-1),
            summary = obj(chosen?.summary),
            context = obj(chosen?.context)
          return {
            questionId: q.id,
            label: q.text,
            status: summary.repeatRequired
              ? 'INVALID'
              : chosen?.status === 'STARTED' &&
                  now.getTime() - chosen.startedAt.getTime() >= 15 * 60000
                ? 'INCOMPLETE'
                : chosen?.status || 'PENDING',
            quality:
              typeof summary.quality === 'string' ? summary.quality : undefined,
            value:
              chosen?.status === 'COMPLETED' && !summary.repeatRequired
                ? number(summary.medianRT)
                : null,
            note:
              Array.isArray(summary.repeatReasons) &&
              summary.repeatReasons.length
                ? summary.repeatReasons.map(String).join(', ')
                : Array.isArray(summary.flags)
                  ? summary.flags.map(String).join(', ')
                  : '',
            unit: 'ms',
            context: chosen
              ? `${chosen.durationSeconds}s · ${String(context.posture || 'position unknown')}`
              : '',
            linked: !!linked,
          }
        }),
    )
    if (!args.focusAvailable && f.assigned) f.state = 'unavailable'
    if (
      f.items.some((i) => {
        const a = r?.answers.find((a) => a.questionId === i.questionId)
        const parsed = a ? parsePvtAnswer(a.value) : null
        const s = parsed ? focusById.get(parsed.attemptId) : null
        return obj(s?.summary).quality === 'REVIEW'
      })
    )
      f.review = true
    const h = state(
      hQuestions
        .filter((q) => !q.createdAt || zonedDay(q.createdAt, timezone) <= date)
        .map((q) => {
          const answer = r?.answers.find((a) => a.questionId === q.id),
            saved = answer ? parseRhrAnswer(answer.value) : null
          const attempts = hr
            .filter(
              (s) =>
                s.playerId === p.id &&
                s.questionId === q.id &&
                s.localDate === date,
            )
            .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
          const chosen =
            attempts.find((s) => s.status === 'ACCEPTED') || attempts[0]
          const stale =
            chosen?.status === 'STARTED' &&
            now.getTime() - chosen.startedAt.getTime() >= 15 * 60000
          return {
            questionId: q.id,
            label: q.text,
            status: saved
              ? 'ACCEPTED'
              : stale
                ? 'INCOMPLETE'
                : chosen?.status || 'PENDING',
            value:
              saved?.bpm ?? (chosen?.status === 'ACCEPTED' ? chosen.bpm : null),
            note:
              !saved && chosen?.status !== 'ACCEPTED'
                ? chosen?.reason?.replaceAll('-', ' ')
                : undefined,
            unit: 'bpm',
            context: [
              saved?.position || chosen?.position,
              typeof saved?.fps === 'number'
                ? `${Math.round(saved.fps)} fps`
                : chosen?.fps
                  ? `${Math.round(chosen.fps)} fps`
                  : '',
            ]
              .filter(Boolean)
              .join(' · '),
            linked: !!saved,
          }
        }),
    )
    if (!args.hrTrackingAvailable && h.assigned && h.submitted < h.assigned)
      h.state = 'unavailable'
    return {
      ...p,
      wellness: r ? ('submitted' as const) : ('pending' as const),
      submittedAt: r?.submittedAt.toISOString() ?? null,
      focus: f,
      hr: h,
    }
  })
  const attempts: ReliabilityAttempt[] = [
    ...focus
      .filter((s) => s.localDate >= start && s.localDate <= date)
      .map((s) => ({
        ...measurementEnvironment(s.userAgent),
        id: s.id,
        playerId: s.playerId,
        test: 'Focus' as const,
        startedAt: s.startedAt,
        status: s.status,
        reason: obj(s.summary).repeatRequired
          ? String(
              (obj(s.summary).repeatReasons as string[] | undefined)?.[0] ||
                'repeat-required',
            )
          : s.status === 'INTERRUPTED'
            ? 'interrupted'
            : null,
        review: obj(s.summary).quality === 'REVIEW',
        source: 'SERVER',
      })),
    ...hr
      .filter((s) => s.localDate >= start && s.localDate <= date)
      .map((s) => ({
        id: s.id,
        playerId: s.playerId,
        test: 'HR' as const,
        startedAt: s.startedAt,
        status: s.status,
        platform: s.platform,
        browser: s.browser,
        reason: s.reason,
        review: false,
        source: s.source,
      })),
  ]
  const reportingDays = dates.filter((d) =>
    players.some((p) => latest.has(`${p.id}|${d}`)),
  )
  const weeklyPlayers = players.map((p) => {
    const rows = [...latest.entries()].filter(
      ([key, r]) =>
        r.playerId === p.id &&
        key.slice(key.lastIndexOf('|') + 1) >= previousStart &&
        key.slice(key.lastIndexOf('|') + 1) <= date,
    )
    const fSamples: MetricSample[] = [],
      hSamples: MetricSample[] = []
    for (const [key, r] of rows) {
      const day = key.slice(key.lastIndexOf('|') + 1)
      for (const q of fQuestions) {
        const s = linkedFocus(r, q.id),
          summary = obj(s?.summary),
          c = obj(s?.context)
        const value = number(summary.medianRT)
        if (s && summary.quality === 'OK' && value !== null)
          fSamples.push({
            day,
            key: [
              q.id,
              s.protocolVersion,
              s.durationSeconds,
              s.deviceId,
              s.userAgent,
              c.posture,
              c.caffeine,
            ].join('|'),
            label: `${q.text} · ${s.durationSeconds}s · ${String(c.posture || 'unknown position')} · caffeine ${c.caffeine === true ? 'yes' : c.caffeine === false ? 'no' : 'unknown'} · ${s.protocolVersion} · ${measurementEnvironment(s.userAgent).platform}/${measurementEnvironment(s.userAgent).browser}`,
            value,
            unit: 'ms',
          })
      }
      for (const q of hQuestions) {
        const a = r.answers.find((a) => a.questionId === q.id),
          s = a ? parseRhrAnswer(a.value) : null
        if (s)
          hSamples.push({
            day,
            key: [q.id, s.position, s.protocolVersion, s.algorithmVersion].join(
              '|',
            ),
            label: `${q.text} · ${s.position} · ${s.protocolVersion}`,
            value: s.bpm,
            unit: 'bpm',
          })
      }
    }
    const values = (ds: string[]) =>
      ds.flatMap((d) => {
        const w = args.wellnessDays[d]?.players.find(
          (x) => x.id === p.id,
        )?.wellness
        return w?.readiness == null ? [] : [w.readiness]
      })
    const current = values(dates),
      previous = values(recentDays(shiftDay(start, -1))),
      wellness = mean(current),
      prior = mean(previous)
    const concerns = dates.filter((d) =>
      ['WATCH', 'ALERT'].includes(
        args.wellnessDays[d]?.players.find((x) => x.id === p.id)?.wellness
          ?.statusText || '',
      ),
    )
    return {
      ...p,
      checkins: dates.filter((d) => latest.has(`${p.id}|${d}`)).length,
      reportingDays: reportingDays.length,
      wellness,
      wellnessDelta:
        current.length >= 3 &&
        previous.length >= 3 &&
        wellness !== null &&
        prior !== null
          ? wellness - prior
          : null,
      wellnessDays: current.length,
      previousWellnessDays: previous.length,
      reviewDays: concerns.length,
      focus: metricGroups(fSamples, start, date),
      hr: metricGroups(hSamples, start, date),
    }
  })
  const daily = dates.map((d) => {
    const rows = players
      .map((p) => latest.get(`${p.id}|${d}`))
      .filter((r): r is InsightResponse => !!r)
    const f = rows.reduce(
      (n, r) => n + fQuestions.filter((q) => linkedFocus(r, q.id)).length,
      0,
    )
    const h = rows.reduce(
      (n, r) =>
        n +
        hQuestions.filter((q) => {
          const a = r.answers.find((a) => a.questionId === q.id)
          return a && parseRhrAnswer(a.value)
        }).length,
      0,
    )
    const w =
      args.wellnessDays[d]?.players.flatMap((p) =>
        p.wellness?.readiness == null ? [] : [p.wellness.readiness],
      ) || []
    return {
      date: d,
      checkins: rows.length,
      focus: f,
      hr: h,
      wellness: mean(w),
    }
  })
  return {
    date,
    timezone,
    generatedAt: now.toISOString(),
    range: {
      start,
      end: date,
      previousStart,
      previousEnd: shiftDay(start, -1),
    },
    available: {
      hrTracking: args.hrTrackingAvailable,
      focus: args.focusAvailable,
    },
    today,
    reliability: {
      groups: aggregateReliability(attempts, now),
      attempts: attempts.length,
      clientReported: attempts.filter((a) => a.source === 'CLIENT').length,
      trackingSince: hr.length
        ? [...hr]
            .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())[0]
            .startedAt.toISOString()
        : null,
    },
    weekly: {
      daily,
      reportingDays: reportingDays.length,
      players: weeklyPlayers,
      totalCheckins: daily.reduce((n, d) => n + d.checkins, 0),
      focusSaved: daily.reduce((n, d) => n + d.focus, 0),
      hrSaved: daily.reduce((n, d) => n + d.hr, 0),
      reviewPlayers: weeklyPlayers.filter((p) => p.reviewDays > 0).length,
    },
  }
}
