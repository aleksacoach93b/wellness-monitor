'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Focus } from 'lucide-react'
import PvtQuestion from './PvtQuestion'
import { pvtOptions } from '@/lib/pvt/options'
import { getSurveyShellClasses, getSurveyUiTokens, resolveSurveyAppearanceTheme, type SurveyAppearanceTheme } from '@/lib/surveyFormAppearance'
export default function PvtPlayer({ surveyId }: { surveyId: string }) {
  const query = useSearchParams()
  const [theme, setTheme] = useState<SurveyAppearanceTheme>(resolveSurveyAppearanceTheme(query.get('surveyTheme') || 'dark'))
  const [duration, setDuration] = useState(30)
  const [value, setValue] = useState('')
  const shell = getSurveyShellClasses(theme), ui = getSurveyUiTokens(theme)
  if (surveyId !== 'demo') return <div className="min-h-screen bg-slate-950 p-8 text-white"><a href={`/survey/${encodeURIComponent(surveyId)}?${query.toString()}`}>Open your wellness questionnaire</a></div>
  return <main className={`min-h-dvh text-white ${shell.root}`}><div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
    <header className="mb-8 flex items-center gap-3"><div className={`rounded-2xl p-3 ${ui.selectedValuePill}`}><Focus className={ui.selectedValueText} size={26} /></div><div><h1 className="text-xl font-semibold tracking-tight">Daily wellness</h1><p className="mt-1 text-sm text-slate-400">Focus test preview · No player data saved</p></div></header>
    <div className="mb-6 flex flex-wrap gap-3"><label className="text-xs text-slate-300">App theme<select className={`ml-2 p-2 text-white ${ui.inputFieldBase}`} value={theme} onChange={e => setTheme(e.target.value as SurveyAppearanceTheme)}>{['dark','green','rose','soft','high'].map(t => <option key={t} value={t}>{t}</option>)}</select></label><label className="text-xs text-slate-300">Protocol<select className={`ml-2 p-2 text-white ${ui.inputFieldBase}`} value={duration} onChange={e => { setDuration(Number(e.target.value)); setValue('') }}><option value={30}>30 seconds</option><option value={60}>60 seconds</option></select></label></div>
    <section className={`rounded-3xl border p-5 sm:p-7 ${shell.card}`}><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold ${ui.selectedValuePill} ${ui.selectedValueText}`}>1</span><h2 className="text-base font-medium">Focus test <span className="text-rose-400">*</span></h2></div><PvtQuestion key={duration} surveyId="demo" question={{ id:'demo-question',options:pvtOptions(duration) }} playerId="demo" theme={theme} value={value} onChange={setValue} demo /></section>
    {value && <button type="button" className={`mt-5 w-full p-3 text-white ${ui.primaryCtaButton}`} onClick={() => setValue('')}>Reset demo</button>}
    <p className="mt-5 text-center text-xs text-slate-400">In the app, this question follows the theme of your wellness survey automatically.</p>
  </div></main>
}
