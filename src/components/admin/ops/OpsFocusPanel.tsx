'use client'

import { Focus, ArrowUpRight } from 'lucide-react'
import type { OpsPlayerCard } from './WellnessFlipCard'
import CSVLinkModal from '@/app/admin/surveys/[id]/results/CSVLinkModal'

type Props = { survey: { id: string; title: string }; date: string; players: OpsPlayerCard[]; available: boolean }
export default function OpsFocusPanel({ survey, date, players, available }: Props) {
  const completed = players.filter(p => p.focus)
  const saved = completed.filter(p => p.focus?.linked).length
  const review = completed.filter(p => p.focus?.quality !== 'OK').length
  const reference = completed.filter(p => p.focus?.deltaPercent != null).length
  const href = (p?: OpsPlayerCard) => `/admin/pvt?${new URLSearchParams({ surveyId: survey.id, date: p?.focus?.localDate || date, ...(p ? { playerId: p.id, ...(p.focus?.questionId ? { questionId: p.focus.questionId } : {}) } : {}) })}`
  return <section className="ops-focus-panel" aria-labelledby="ops-focus-title">
    <div className="ops-focus-heading">
      <div><p><Focus size={16} /> ATTENTION MONITORING</p><h2 id="ops-focus-title">Focus test</h2><span>{date} · Submitted results alongside daily wellness</span></div>
      <div className="ops-focus-actions"><CSVLinkModal surveyId={survey.id} surveyTitle={survey.title} /><a href={href()}>Focus analytics <ArrowUpRight size={16} /></a></div>
    </div>
    {!available ? <p role="status">Focus results could not be loaded. Refresh to try again.</p> : <>
      <div className="ops-focus-stats">
        <div><small>Completed</small><strong>{completed.length}<em> / {players.length}</em></strong></div>
        <div><small>In wellness CSV</small><strong>{saved}<em> · {completed.length - saved} awaiting submission</em></strong></div>
        <div><small>Quality review</small><strong>{review}<em> completed tests</em></strong></div>
        <div><small>Personal reference</small><strong>{reference}<em> players with eligible history</em></strong></div>
      </div>
      <details className="ops-focus-details">
        <summary>Player results <span>Reaction time · quality · context · submission</span></summary>
        <div className="ops-focus-scroll"><table><thead><tr>{['Player', 'Median RT', 'Quality / status', 'Personal reference', 'Context', 'Wellness CSV'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>
          {players.map(p => <tr key={p.id}><td><a href={href(p)}>{p.firstName} {p.lastName}<ArrowUpRight size={13} /></a></td>
            <td>{p.focus?.medianRT == null ? '—' : `${Math.round(p.focus.medianRT)} ms`}<small>{p.focus ? `${p.focus.duration} s · ${p.focus.count} completed today` : ''}</small></td>
            <td>{p.focus?.quality || (p.focusState === 'INVALID' ? 'Repeat required' : p.focusState === 'INTERRUPTED' ? 'Interrupted · repeat required' : p.focusState === 'STARTED' ? 'Not completed' : 'Pending')}<small>{p.focus?.flags.join(' · ')}</small></td>
            <td>{p.focus ? p.focus.deltaPercent == null ? `${p.focus.baselineDays}/7 eligible days` : `${p.focus.deltaPercent > 0 ? '+' : ''}${p.focus.deltaPercent.toFixed(1)}% median RT` : '—'}</td>
            <td>{p.focus?.posture || '—'}<small>{p.focus ? `${p.focus.minutesAwake ?? '—'} min awake · Caffeine ${p.focus.caffeine === undefined ? '—' : p.focus.caffeine ? 'yes' : 'no'}` : ''}</small></td>
            <td>{p.focus ? p.focus.linked ? 'Included' : 'Awaiting wellness submission' : 'No submitted result'}</td></tr>)}
        </tbody></table></div>
        <p>Submitted attempt where available; otherwise the first completed official attempt for this date. Repeats and practice remain in Focus analytics. Main CSV includes the attempt attached to each submitted wellness response. Positive change means slower reaction time, not a fatigue percentage.</p>
      </details>
    </>}
  </section>
}
