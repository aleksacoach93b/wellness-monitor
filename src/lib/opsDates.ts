export function validDay(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T12:00:00Z')) &&
    new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value
  )
}
export function shiftDay(day: string, amount: number) {
  const date = new Date(day + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}
export function zonedDay(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: string) => parts.find((p) => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function recentDays(end: string, count = 7) {
  return Array.from({ length: count }, (_, i) => shiftDay(end, i - count + 1))
}

/** UTC boundaries for a survey-local calendar day, including 23/25-hour DST days. */
export function dayWindow(day: string, timezone: string) {
  const boundary = (target: string) => {
    const center = Date.parse(target + 'T00:00:00Z') / 1000
    let lo = center - 172800,
      hi = center + 172800
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)
      if (zonedDay(new Date(mid * 1000), timezone) < target) lo = mid + 1
      else hi = mid
    }
    return new Date(lo * 1000)
  }
  return {
    dayStart: boundary(day),
    dayEnd: boundary(shiftDay(day, 1)),
    selectedDate: day,
  }
}
