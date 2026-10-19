'use client'
import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Focus,
  Heart,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  UserRound,
  ShieldCheck,
} from 'lucide-react'
import type {
  OpsInsights,
  MeasurementState,
  WeeklyMetric,
} from '@/lib/opsInsights'
import CSVLinkModal from '@/app/admin/surveys/[id]/results/CSVLinkModal'
import './ops-monitoring.css'
export type OpsTab =
  'daily' | 'measurements' | 'reliability' | 'weekly' | 'settings' | 'individual'
const tabs = [
  { id: 'daily', label: 'Daily overview', icon: Activity },
  { id: 'individual', label: 'Individual player', icon: UserRound },
  { id: 'measurements', label: 'Measurements', icon: Focus },
  { id: 'reliability', label: 'Reliability', icon: ShieldCheck },
  { id: 'weekly', label: 'Weekly report', icon: CalendarDays },
  { id: 'settings', label: 'Rules & metrics', icon: Settings2 },
] as const
const labels: Record<MeasurementState['state'], string> = {
  unavailable: 'History unavailable',
  'not-assigned': 'Not assigned',
  pending: 'Pending',
  'in-progress': 'In progress',
  repeat: 'Repeat / review',
  'awaiting-submission': 'Awaiting questionnaire',
  saved: 'Saved with wellness',
}
const fmt = (v: number | null, digits = 0) =>
  v === null ? '—' : v.toFixed(digits)
const signed = (v: number | null, unit = '') =>
  v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}${unit}`
const needsFollowup = (p: OpsInsights['today'][number]) =>
  p.wellness === 'pending' ||
  p.focus.review ||
  p.hr.review ||
  [p.focus, p.hr].some(
    (s) => s.assigned > 0 && s.state !== 'saved' && s.state !== 'unavailable',
  )
function Badge({ state }: { state: MeasurementState }) {
  return (
    <span className="opsm-badge" data-state={state.state}>
      {labels[state.state]}
      {state.review && state.state !== 'repeat' ? ' · Quality review' : ''}
    </span>
  )
}
function Cell({ state }: { state: MeasurementState }) {
  return (
    <td>
      <Badge state={state} />
      {state.items.map((item) => (
        <div className="opsm-measure-value" key={item.questionId}>
          <strong>
            {item.value === null ? '—' : `${fmt(item.value)} ${item.unit}`}
          </strong>
          <span>
            {item.label}
            {item.context ? ` · ${item.context}` : ''}
          </span>
          {item.note && <small>{item.note.replaceAll('-', ' ')}</small>}
          {state.items.length > 1 && (
            <small>
              {item.linked
                ? 'Saved with wellness'
                : item.status.replaceAll('_', ' ').toLowerCase()}
            </small>
          )}
        </div>
      ))}
    </td>
  )
}
function MetricCell({ metrics }: { metrics: WeeklyMetric[] }) {
  return (
    <td>
      {!metrics.length
        ? '—'
        : metrics.map((m, i) => (
            <div className="opsm-week-metric" key={`${m.label}:${i}`}>
              <strong>
                {fmt(m.median, 1)} {m.unit}
              </strong>
              <span>
                {m.label} · {m.days} day{m.days === 1 ? '' : 's'}
              </span>
              <small>
                {m.delta === null
                  ? `Comparison needs 3 days per period (${m.days}/${m.previousDays})`
                  : `${signed(m.delta, ` ${m.unit}`)} vs previous 7 days`}
              </small>
            </div>
          ))}
    </td>
  )
}
export default function OpsMonitoringHub({
  survey,
  date,
  refreshKey,
  tab,
  onTab,
  search,
  onSearch,
}: {
  survey: { id: string; title: string }
  date: string
  refreshKey: string
  tab: OpsTab
  onTab: (tab: OpsTab) => void
  search: string
  onSearch: (s: string) => void
}) {
  const [loaded, setLoaded] = useState<{
      surveyId: string
      data: OpsInsights
    } | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [retry, setRetry] = useState(0),
    [filter, setFilter] = useState('all'),
    [test, setTest] = useState('all')
  const data =
    loaded?.surveyId === survey.id && loaded.data.date === date
      ? loaded.data
      : null
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError('')
    void fetch(
      `/api/ops/insights?${new URLSearchParams({ surveyId: survey.id, date })}`,
      { cache: 'no-store', signal: controller.signal },
    )
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw Error(body.error || 'Unable to load monitoring')
        if (active) setLoaded({ surveyId: survey.id, data: body })
      })
      .catch((e) => {
        if (active && e.name !== 'AbortError')
          setError(e.message || 'Unable to load monitoring')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [survey.id, date, refreshKey, retry])
  const rows = (data?.today || [])
    .filter((p) =>
      `${p.firstName} ${p.lastName}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    )
    .filter(
      (p) =>
        filter === 'all' ||
        (filter === 'follow-up' && needsFollowup(p)) ||
        (filter === 'repeat' && (p.focus.review || p.hr.review)) ||
        (filter === 'awaiting' &&
          (p.focus.state === 'awaiting-submission' ||
            p.hr.state === 'awaiting-submission')),
    )
    .sort(
      (a, b) =>
        Number(needsFollowup(b)) - Number(needsFollowup(a)) ||
        a.lastName.localeCompare(b.lastName),
    )
  const groups = (data?.reliability.groups || []).filter(
    (g) => test === 'all' || g.test === test,
  )
  const total = (
    key:
      | 'total'
      | 'accepted'
      | 'repeat'
      | 'cameraErrors'
      | 'interrupted'
      | 'unfinished'
      | 'inProgress'
      | 'review',
  ) => groups.reduce((n, g) => n + g[key], 0)
  const acceptedRate =
    total('total') - total('inProgress') > 0
      ? (100 * total('accepted')) / (total('total') - total('inProgress'))
      : null
  const focusPlayers =
      data?.today.filter(
        (p) => p.focus.assigned > 0 && p.focus.completed === p.focus.assigned,
      ).length ?? 0,
    hrPlayers =
      data?.today.filter(
        (p) => p.hr.assigned > 0 && p.hr.completed === p.hr.assigned,
      ).length ?? 0
  const followups = data?.today.filter(needsFollowup) || []
  return (
    <div className="opsm-hub">
      <div className="opsm-topline">
        <nav className="opsm-tabs" aria-label="Live Ops sections">
          {tabs.map((t) => (
            <button
              type="button"
              key={t.id}
              aria-current={tab === t.id ? 'page' : undefined}
              className={tab === t.id ? 'is-active' : ''}
              onClick={() => onTab(t.id)}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </nav>
        <CSVLinkModal surveyId={survey.id} surveyTitle={survey.title} />
      </div>
      {(tab === 'daily' || tab === 'measurements') && (
        <div className="opsm-search">
          <Search size={17} />
          <input
            aria-label="Search players"
            placeholder="Find a player…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
          <span>
            {data?.timezone || ''}
            {loading && <Loader2 size={14} className="animate-spin" />}
          </span>
        </div>
      )}
      {error && (
        <div className="opsm-error" role="alert">
          <span>{error} Your wellness data is unaffected.</span>
          <button type="button" onClick={() => setRetry((r) => r + 1)}>
            <RefreshCw size={14} />
            Retry monitoring
          </button>
        </div>
      )}
      {!data && loading && tab !== 'settings' && tab !== 'individual' && (
        <div className="opsm-loading" role="status">
          <Loader2 className="animate-spin" size={20} />
          Loading team monitoring…
        </div>
      )}
      {data && (tab === 'daily' || tab === 'measurements') && (
        <>
          <div className="opsm-stats">
            <div>
              <ClipboardCheck size={19} />
              <small>Questionnaires submitted</small>
              <strong>
                {data.today.filter((p) => p.wellness === 'submitted').length}
                <em> / {data.today.length}</em>
              </strong>
              <span>Saved wellness responses</span>
            </div>
            <div>
              <Focus size={19} />
              <small>Focus completed</small>
              <strong>
                {data.available.focus ? focusPlayers : '—'}
                <em>
                  {' '}
                  / {data.today.filter((p) => p.focus.assigned > 0).length}
                </em>
              </strong>
              <span>
                {
                  data.today.filter(
                    (p) => p.focus.state === 'awaiting-submission',
                  ).length
                }{' '}
                awaiting questionnaire
              </span>
            </div>
            <div>
              <Heart size={19} />
              <small>Resting HR completed</small>
              <strong>
                {data.available.hrTracking || hrPlayers > 0 ? hrPlayers : '—'}
                <em> / {data.today.filter((p) => p.hr.assigned > 0).length}</em>
              </strong>
              <span>
                {
                  data.today.filter((p) => p.hr.state === 'awaiting-submission')
                    .length
                }{' '}
                awaiting questionnaire
              </span>
            </div>
            <div data-attention={followups.length > 0}>
              <Activity size={19} />
              <small>Follow-up queue</small>
              <strong>{followups.length}</strong>
              <span>Missing submissions, tests or quality review</span>
            </div>
          </div>
          {(!data.available.focus || !data.available.hrTracking) && (
            <p className="opsm-note" role="status">
              {!data.available.focus
                ? 'Focus attempt history is temporarily unavailable. '
                : ''}
              {!data.available.hrTracking
                ? 'HR outcome tracking is temporarily unavailable; saved questionnaire readings remain visible.'
                : ''}
            </p>
          )}
          {tab === 'daily' && (
            <div className="opsm-queue">
              <div>
                <p className="opsm-kicker">TODAY’S FOLLOW-UP</p>
                <h2>
                  {followups.length
                    ? 'Finish the check-in picture.'
                    : !data.available.focus || !data.available.hrTracking
                      ? 'Check-in summary'
                      : 'All recorded check-ins are complete.'}
                </h2>
                <p>
                  {followups.length
                    ? 'Open Measurements to see missing tests, repeats and results awaiting questionnaire submission.'
                    : 'Completed results are linked to the submitted questionnaire.'}
                </p>
              </div>
              <div className="opsm-queue-names">
                {followups.slice(0, 4).map((p) => (
                  <span key={p.id}>
                    {p.firstName} {p.lastName}
                    <small>
                      {p.wellness === 'pending'
                        ? 'Questionnaire pending'
                        : p.focus.review || p.hr.review
                          ? 'Measurement quality review'
                          : 'Test result missing'}
                    </small>
                  </span>
                ))}
                {followups.length > 4 && (
                  <small>+ {followups.length - 4} more players</small>
                )}
              </div>
              <button type="button" onClick={() => onTab('measurements')}>
                Open measurements <ArrowRight size={16} />
              </button>
            </div>
          )}
          {tab === 'measurements' && (
            <section
              className="opsm-panel"
              aria-label="Team measurement status"
            >
              <div className="opsm-panel-head">
                <div>
                  <p className="opsm-kicker">ONE ROSTER · ALL CHECKS</p>
                  <h2>Measurement board</h2>
                  <p>
                    {date} · Tests stay separate from the wellness readiness
                    score.
                  </p>
                </div>
                <label>
                  Show
                  <select
                    aria-label="Measurement filter"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All players</option>
                    <option value="follow-up">Needs follow-up</option>
                    <option value="repeat">Repeat / quality review</option>
                    <option value="awaiting">Awaiting questionnaire</option>
                  </select>
                </label>
              </div>
              <p className="opsm-scroll-hint">
                Swipe the table sideways to see all measurements →
              </p>
              <div
                className="opsm-scroll"
                role="region"
                aria-label="Scrollable results table"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Questionnaire</th>
                      <th>Focus</th>
                      <th>Resting HR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.id}>
                        <td className="opsm-player">
                          {p.firstName} {p.lastName}
                          <small>
                            {p.submittedAt
                              ? new Date(p.submittedAt).toLocaleTimeString(
                                  'en-GB',
                                  {
                                    timeZone: data.timezone,
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  },
                                )
                              : 'No questionnaire submission'}
                          </small>
                        </td>
                        <td>
                          <span
                            className="opsm-badge"
                            data-state={
                              p.wellness === 'submitted' ? 'saved' : 'pending'
                            }
                          >
                            {p.wellness === 'submitted'
                              ? 'Submitted'
                              : 'Pending'}
                          </span>
                        </td>
                        <Cell state={p.focus} />
                        <Cell state={p.hr} />
                      </tr>
                    ))}
                    {!rows.length && (
                      <tr>
                        <td colSpan={4}>No players match this filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="opsm-note">
                “Awaiting questionnaire” is an accepted test that is not yet in
                the main wellness CSV. Submitted values take precedence. HR
                attempts before outcome tracking started cannot be
                reconstructed.
              </p>
            </section>
          )}
        </>
      )}
      {data && tab === 'reliability' && (
        <section className="opsm-panel" aria-label="Measurement reliability">
          <div className="opsm-panel-head">
            <div>
              <p className="opsm-kicker">CAPTURE & COMPLETION</p>
              <h2>Measurement reliability</h2>
              <p>
                {data.range.start} — {data.range.end} · {data.timezone}
              </p>
            </div>
            <label>
              Test
              <select
                aria-label="Reliability test"
                value={test}
                onChange={(e) => setTest(e.target.value)}
              >
                <option value="all">HR + Focus</option>
                <option value="HR">Resting HR</option>
                <option value="Focus">Focus</option>
              </select>
            </label>
          </div>
          <div className="opsm-stats">
            <div>
              <small>Recorded attempts</small>
              <strong>{total('total')}</strong>
              <span>{total('inProgress')} in progress</span>
            </div>
            <div>
              <small>Accepted / completed</small>
              <strong>
                {fmt(acceptedRate, 1)}
                <em>{acceptedRate === null ? '' : '%'}</em>
              </strong>
              <span>
                {total('accepted')} accepted; active attempts excluded from rate
              </span>
            </div>
            <div>
              <small>Repeat or camera error</small>
              <strong>{total('repeat') + total('cameraErrors')}</strong>
              <span>{total('cameraErrors')} camera setup errors</span>
            </div>
            <div>
              <small>Interrupted / unfinished</small>
              <strong>{total('interrupted') + total('unfinished')}</strong>
              <span>
                {total('review')} completed Focus tests flagged for review
              </span>
            </div>
          </div>
          {(!data.available.hrTracking || !data.available.focus) && (
            <p role="status" className="opsm-error">
              Some tracking history could not be loaded. These totals may be
              incomplete.
            </p>
          )}
          <p className="opsm-scroll-hint">
            Swipe the table sideways to see all measurements →
          </p>
          <div
            className="opsm-scroll"
            role="region"
            aria-label="Scrollable results table"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Test / device group</th>
                  <th>Attempts</th>
                  <th>Accepted</th>
                  <th>Repeat</th>
                  <th>Camera errors</th>
                  <th>Interrupted / unfinished</th>
                  <th>Completion</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.key}>
                    <td>
                      <strong>{g.test}</strong>
                      <small>
                        {g.platform} · {g.browser}
                      </small>
                    </td>
                    <td>
                      {g.total}
                      <small>{g.inProgress} in progress</small>
                    </td>
                    <td>{g.accepted}</td>
                    <td>{g.repeat}</td>
                    <td>{g.cameraErrors}</td>
                    <td>{g.interrupted + g.unfinished}</td>
                    <td>
                      <strong>
                        {fmt(g.rate, 1)}
                        {g.rate === null ? '' : '%'}
                      </strong>
                      <span className="opsm-mini-track">
                        <i style={{ width: `${g.rate ?? 0}%` }} />
                      </span>
                    </td>
                  </tr>
                ))}
                {!groups.length && (
                  <tr>
                    <td colSpan={7}>No recorded attempts in this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="opsm-reasons">
            {groups
              .filter((g) => g.reasons.length)
              .map((g) => (
                <div key={g.key}>
                  <h3>
                    {g.test} · {g.platform} / {g.browser}
                  </h3>
                  {g.reasons.slice(0, 5).map((r) => (
                    <span key={r.reason}>
                      {r.reason.replaceAll('-', ' ')}
                      <b>{r.count}</b>
                    </span>
                  ))}
                </div>
              ))}
          </div>
          <p className="opsm-note">
            Completion describes recorded attempts, not measurement accuracy or
            fatigue. Practice Focus tests are excluded. Unfinished starts become
            “unfinished” after 15 minutes; they are not assumed to be bad
            signals. HR tracking starts with this release; historical failed
            scans are unavailable. {data.reliability.clientReported} outcomes
            were reported by the player’s browser. Basic platform/browser groups
            are stored; precise phone models are not inferred. Video, optical
            samples and local diagnostics are not stored in this tracking table.
          </p>
        </section>
      )}
      {data && tab === 'weekly' && (
        <section
          id="ops-weekly-report"
          className="opsm-panel opsm-weekly"
          aria-label="Weekly team report"
        >
          <div className="opsm-panel-head">
            <div>
              <p className="opsm-kicker">COACHING STAFF REPORT</p>
              <h2>Weekly monitoring report</h2>
              <p>
                {survey.title} · {data.range.start} — {data.range.end} ·{' '}
                {data.timezone}
              </p>
            </div>
            <button
              className="opsm-print"
              type="button"
              onClick={() => window.print()}
            >
              <Printer size={16} />
              Print / save PDF
            </button>
          </div>
          {!data.available.focus && (
            <p role="status" className="opsm-error">
              Focus history could not be loaded. Focus counts and medians are
              unavailable in this report.
            </p>
          )}
          {!data.available.hrTracking && (
            <p role="status" className="opsm-error">
              HR attempt tracking could not be loaded. Saved HR readings remain
              available; reliability counts are incomplete.
            </p>
          )}
          <div className="opsm-stats">
            <div>
              <small>Questionnaires</small>
              <strong>{data.weekly.totalCheckins}</strong>
              <span>{data.weekly.reportingDays} observed check-in days</span>
            </div>
            <div>
              <small>Saved Focus results</small>
              <strong>
                {data.available.focus ? data.weekly.focusSaved : '—'}
              </strong>
              <span>Linked to wellness submissions</span>
            </div>
            <div>
              <small>Saved HR readings</small>
              <strong>{data.weekly.hrSaved}</strong>
              <span>Grouped by position and protocol</span>
            </div>
            <div>
              <small>Wellness follow-up</small>
              <strong>{data.weekly.reviewPlayers}</strong>
              <span>Players with existing WATCH / ALERT days</span>
            </div>
          </div>
          <div className="opsm-week-summary">
            <CheckCircle2 size={21} />
            <div>
              <h3>Staff briefing</h3>
              <p>
                {data.weekly.totalCheckins} questionnaires were submitted across{' '}
                {data.weekly.reportingDays} days with squad submissions.{' '}
                {
                  data.weekly.players.filter(
                    (p) => p.reportingDays > 0 && p.checkins < p.reportingDays,
                  ).length
                }{' '}
                players missed at least one of those observed check-in days.{' '}
                {data.weekly.reviewPlayers} players had one or more wellness
                WATCH / ALERT days.
              </p>
              <p>
                {data.reliability.groups.reduce(
                  (n, g) => n + g.repeat + g.cameraErrors,
                  0,
                )}{' '}
                available recorded attempts required a repeat or had a camera
                error. Check the Reliability tab for device/browser groups.
              </p>
            </div>
          </div>
          <div
            className="opsm-daily-chart"
            role="list"
            aria-label="Daily questionnaire participation"
          >
            {data.weekly.daily.map((d) => (
              <div
                key={d.date}
                role="listitem"
                aria-label={`${d.date}: ${d.checkins} of ${data.today.length} questionnaires`}
              >
                <strong>
                  {d.checkins}
                  <small> / {data.today.length}</small>
                </strong>
                <span className="opsm-chart-bar">
                  <i
                    style={{
                      height: `${data.today.length ? (100 * d.checkins) / data.today.length : 0}%`,
                    }}
                  />
                </span>
                <span>
                  {new Date(d.date + 'T12:00:00Z').toLocaleDateString('en-GB', {
                    timeZone: 'UTC',
                    weekday: 'short',
                  })}
                </span>
                <small>{d.date.slice(5)}</small>
              </div>
            ))}
          </div>
          <p className="opsm-scroll-hint">
            Swipe the table sideways to see all measurements →
          </p>
          <div
            className="opsm-scroll"
            role="region"
            aria-label="Scrollable results table"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Check-in days</th>
                  <th>Wellness / 10</th>
                  <th>Focus median</th>
                  <th>Resting HR median</th>
                  <th>Follow-up days</th>
                </tr>
              </thead>
              <tbody>
                {[...data.weekly.players]
                  .sort(
                    (a, b) =>
                      b.reviewDays - a.reviewDays ||
                      a.checkins - b.checkins ||
                      a.lastName.localeCompare(b.lastName),
                  )
                  .map((p) => (
                    <tr key={p.id}>
                      <td className="opsm-player">
                        {p.firstName} {p.lastName}
                      </td>
                      <td>
                        {p.checkins} / {p.reportingDays}
                        <small>Observed squad days</small>
                      </td>
                      <td>
                        {fmt(p.wellness, 1)}
                        <small>
                          {p.wellnessDays} days · {signed(p.wellnessDelta)} vs
                          previous period
                        </small>
                      </td>
                      <MetricCell metrics={p.focus} />
                      <MetricCell metrics={p.hr} />
                      <td>
                        {p.reviewDays}
                        <small>Existing wellness WATCH / ALERT</small>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="opsm-note">
            Seven calendar days ending on the selected date; comparison is the
            preceding seven days. Participation denominators use days with at
            least one squad questionnaire, so rest days are not invented. No
            submission does not prove a test was not attempted. Medians use one
            submitted result per player, question and local date; practice and
            invalid Focus results are excluded. Focus contexts/devices/protocols
            are kept separate; HR positions/protocols are kept separate, but
            historical HR device matching is unavailable. Changes require at
            least three recorded days in each period and are descriptive, not a
            fatigue diagnosis or automatic training decision.
          </p>
          <p className="opsm-report-generated">
            Generated{' '}
            {new Date(data.generatedAt).toLocaleString('en-GB', {
              timeZone: data.timezone,
            })}
          </p>
        </section>
      )}
    </div>
  )
}
