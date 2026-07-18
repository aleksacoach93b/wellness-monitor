'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type DayInfo = { done: number; total: number }

type Props = {
  selectedDate: string
  surveyId: string
  onSelect: (date: string) => void
}

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toKey(y: number, m0: number, d: number) {
  return `${y}-${pad(m0 + 1)}-${pad(d)}`
}

function parseKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return { y, m0: m - 1, d }
}

function localTodayKey() {
  const n = new Date()
  return toKey(n.getFullYear(), n.getMonth(), n.getDate())
}

export default function OpsCalendar({ selectedDate, surveyId, onSelect }: Props) {
  const selected = parseKey(selectedDate)
  const [cursor, setCursor] = useState({ y: selected.y, m0: selected.m0 })
  const [mode, setMode] = useState<'month' | 'week'>('month')
  const [days, setDays] = useState<Record<string, DayInfo>>({})
  const todayKey = localTodayKey()

  useEffect(() => {
    const s = parseKey(selectedDate)
    setCursor({ y: s.y, m0: s.m0 })
  }, [selectedDate])

  useEffect(() => {
    const month = `${cursor.y}-${pad(cursor.m0 + 1)}`
    const params = new URLSearchParams({ month })
    if (surveyId) params.set('surveyId', surveyId)
    let cancelled = false
    void fetch(`/api/ops/calendar?${params}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (!cancelled && payload?.days) setDays(payload.days)
      })
      .catch(() => {
        if (!cancelled) setDays({})
      })
    return () => {
      cancelled = true
    }
  }, [cursor.y, cursor.m0, surveyId])

  const cells = useMemo(() => {
    if (mode === 'week') {
      const sel = new Date(selected.y, selected.m0, selected.d)
      const day = (sel.getDay() + 6) % 7 // Mon=0
      const monday = new Date(sel)
      monday.setDate(sel.getDate() - day)
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        return {
          key: toKey(d.getFullYear(), d.getMonth(), d.getDate()),
          day: d.getDate(),
          inMonth: d.getMonth() === cursor.m0,
        }
      })
    }

    const first = new Date(cursor.y, cursor.m0, 1)
    const startPad = (first.getDay() + 6) % 7
    const daysInMonth = new Date(cursor.y, cursor.m0 + 1, 0).getDate()
    const out: Array<{ key: string; day: number; inMonth: boolean }> = []
    for (let i = 0; i < startPad; i++) {
      const d = new Date(cursor.y, cursor.m0, -startPad + i + 1)
      out.push({
        key: toKey(d.getFullYear(), d.getMonth(), d.getDate()),
        day: d.getDate(),
        inMonth: false,
      })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ key: toKey(cursor.y, cursor.m0, d), day: d, inMonth: true })
    }
    while (out.length % 7 !== 0) {
      const last = out[out.length - 1]
      const [y, m, d] = last.key.split('-').map(Number)
      const next = new Date(y, m - 1, d + 1)
      out.push({
        key: toKey(next.getFullYear(), next.getMonth(), next.getDate()),
        day: next.getDate(),
        inMonth: false,
      })
    }
    return out
  }, [cursor, mode, selected.y, selected.m0, selected.d])

  const title = new Date(cursor.y, cursor.m0, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const shift = (dir: -1 | 1) => {
    if (mode === 'week') {
      const base = new Date(selected.y, selected.m0, selected.d)
      base.setDate(base.getDate() + dir * 7)
      onSelect(toKey(base.getFullYear(), base.getMonth(), base.getDate()))
      return
    }
    const d = new Date(cursor.y, cursor.m0 + dir, 1)
    setCursor({ y: d.getFullYear(), m0: d.getMonth() })
  }

  return (
    <section className="ops-cal">
      <header className="ops-cal-head">
        <div>
          <h3 className="ops-cal-title">Calendar</h3>
          <p className="ops-cal-copy">Navigate through daily surveys quickly</p>
        </div>
        <div className="ops-cal-mode">
          <button
            type="button"
            className={mode === 'month' ? 'is-on' : ''}
            onClick={() => setMode('month')}
          >
            Month
          </button>
          <button
            type="button"
            className={mode === 'week' ? 'is-on' : ''}
            onClick={() => setMode('week')}
          >
            Week
          </button>
        </div>
      </header>

      <div className="ops-cal-nav">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h4>{title}</h4>
        <button type="button" onClick={() => shift(1)} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="ops-cal-weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className={`ops-cal-grid ${mode === 'week' ? 'is-week' : ''}`}>
        {cells.map((cell) => {
          const info = days[cell.key]
          const selectedCell = cell.key === selectedDate
          const isToday = cell.key === todayKey
          const complete = info && info.total > 0 && info.done >= info.total
          const partial = info && info.done > 0 && !complete
          return (
            <button
              key={cell.key}
              type="button"
              disabled={cell.key > todayKey}
              onClick={() => onSelect(cell.key)}
              className={[
                'ops-cal-day',
                cell.inMonth ? '' : 'is-out',
                selectedCell ? 'is-selected' : '',
                isToday ? 'is-today' : '',
                info ? 'has-data' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span>{cell.day}</span>
              {info ? (
                <i
                  className={complete ? 'dot-ok' : partial ? 'dot-warn' : 'dot-mute'}
                  title={`${info.done}/${info.total} submitted`}
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}
