'use client'
import { useState } from 'react'
import RhrQuestion from '@/components/rhr/RhrQuestion'
import {
  getSurveyShellClasses,
  type SurveyAppearanceTheme,
} from '@/lib/surveyFormAppearance'
export default function RhrDemo() {
  const [value, setValue] = useState(''),
    [theme, setTheme] = useState<SurveyAppearanceTheme>('dark')
  const shell = getSurveyShellClasses(theme)
  return (
    <main className={`min-h-dvh text-white px-4 py-10 ${shell.root}`}>
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold">Resting heart rate</h1>
        <p className="my-3 text-sm text-slate-300">
          15-second rear-camera preview · No player data saved
        </p>
        <label className="text-sm">
          App theme{' '}
          <select
            className="ml-2 rounded-xl bg-slate-800 p-2"
            value={theme}
            onChange={(e) => setTheme(e.target.value as SurveyAppearanceTheme)}
          >
            {['dark', 'green', 'rose', 'soft', 'high'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <section className={`mt-6 rounded-3xl border p-5 ${shell.card}`}>
          <RhrQuestion
            surveyId="demo"
            question={{ id: 'rhr-demo' }}
            playerId="demo"
            value={value}
            onChange={setValue}
            theme={theme}
            demo
          />
        </section>
        {value && (
          <button
            type="button"
            className="mt-5 w-full rounded-xl bg-blue-600 p-3"
            onClick={() => setValue('')}
          >
            Reset demo
          </button>
        )}
        <p className="mt-5 text-sm text-slate-400">
          Requires a supported rear camera and camera light. Accuracy on your
          phone still needs comparison with a reference measurement.
        </p>
      </div>
    </main>
  )
}
