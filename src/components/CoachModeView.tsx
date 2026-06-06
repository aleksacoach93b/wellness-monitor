'use client'

import { useState, useCallback, useMemo } from 'react'
import { Survey, Question, Player } from '@prisma/client'
import { CheckCircle, AlertTriangle, Clock, Send, ArrowDownAZ, ArrowUpZA } from 'lucide-react'
import Image from 'next/image'
import BodyMap from '@/components/BodyMap'
import { createPortal } from 'react-dom'
import type { KioskTheme } from '@/lib/kioskThemes'
import { kioskThemes } from '@/lib/kioskThemes'
import { surveyThemeFromKiosk } from '@/lib/surveyFormAppearance'

interface PlayerWithStatus extends Player {
  hasResponded: boolean
  responseId?: string
}

interface SurveyWithQuestions extends Survey {
  questions: Question[]
}

interface PlayerAnswers {
  [questionId: string]: string
}

interface CoachModeViewProps {
  survey: SurveyWithQuestions
  players: PlayerWithStatus[]
  kioskTheme: KioskTheme
  onBack: () => void
  onRefresh: () => void
}

const RPE_COLORS: Record<number, string> = {
  1: 'from-green-600 to-green-700 border-green-400/50',
  2: 'from-green-500 to-green-600 border-green-400/50',
  3: 'from-lime-500 to-lime-600 border-lime-400/50',
  4: 'from-yellow-500 to-yellow-600 border-yellow-400/50',
  5: 'from-amber-500 to-amber-600 border-amber-400/50',
  6: 'from-orange-500 to-orange-600 border-orange-400/50',
  7: 'from-orange-600 to-orange-700 border-orange-400/50',
  8: 'from-red-500 to-red-600 border-red-400/50',
  9: 'from-red-600 to-red-700 border-red-400/50',
  10: 'from-red-700 to-red-800 border-red-400/50',
}

const RPE_IDLE_TINT: Record<number, string> = {
  1: 'bg-green-900/30 border-green-700/30 text-green-300/80',
  2: 'bg-green-900/25 border-green-700/25 text-green-300/70',
  3: 'bg-lime-900/25 border-lime-700/25 text-lime-300/70',
  4: 'bg-yellow-900/25 border-yellow-700/25 text-yellow-300/70',
  5: 'bg-amber-900/25 border-amber-700/25 text-amber-300/70',
  6: 'bg-orange-900/25 border-orange-700/25 text-orange-300/70',
  7: 'bg-orange-900/30 border-orange-700/30 text-orange-300/70',
  8: 'bg-red-900/25 border-red-700/25 text-red-300/70',
  9: 'bg-red-900/30 border-red-700/30 text-red-300/70',
  10: 'bg-red-900/35 border-red-700/35 text-red-300/80',
}

const RPE_LABELS: Record<number, string> = {
  1: 'Rest',
  2: 'Very Easy',
  3: 'Easy',
  4: 'Moderate',
  5: 'Somewhat Hard',
  6: 'Hard',
  7: 'Very Hard',
  8: 'Very Hard+',
  9: 'Near Max',
  10: 'Max Effort',
}

export default function CoachModeView({
  survey,
  players,
  kioskTheme,
  onBack,
  onRefresh,
}: CoachModeViewProps) {
  const activeTheme = kioskThemes[kioskTheme] ?? kioskThemes.dark

  const scaleQuestions = survey.questions.filter(
    (q) => q.type === 'SCALE' || q.type === 'RPE' || q.type === 'RATING_SCALE'
  )
  const sliderQuestions = survey.questions.filter((q) => q.type === 'SLIDER')
  const booleanQuestions = survey.questions.filter((q) => q.type === 'BOOLEAN')
  const bodyMapQuestions = survey.questions.filter((q) => q.type === 'BODY_MAP')
  const textQuestions = survey.questions.filter(
    (q) => q.type === 'TEXT' || q.type === 'NUMBER' || q.type === 'TIME'
  )

  const [playerData, setPlayerData] = useState<
    Record<string, { answers: PlayerAnswers; bodyMapData: Record<string, Record<string, number>>; done: boolean }>
  >(() => {
    const initial: Record<string, { answers: PlayerAnswers; bodyMapData: Record<string, Record<string, number>>; done: boolean }> = {}
    for (const p of players) {
      const answers: PlayerAnswers = {}
      for (const q of survey.questions) {
        if (q.type === 'BODY_MAP') answers[q.id] = 'No'
      }
      initial[p.id] = { answers, bodyMapData: {}, done: p.hasResponded }
    }
    return initial
  })

  const [globalDuration, setGlobalDuration] = useState('60')
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {}
    for (const p of players) {
      if (p.hasResponded) s[p.id] = true
    }
    return s
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sortAsc, setSortAsc] = useState(true)

  const [showBodyMap, setShowBodyMap] = useState(false)
  const [bodyMapPlayerId, setBodyMapPlayerId] = useState<string | null>(null)
  const [bodyMapQuestionId, setBodyMapQuestionId] = useState<string | null>(null)
  const [bodyMapView, setBodyMapView] = useState<'front' | 'back'>('front')

  const sortedPlayers = useMemo(() => {
    const sorted = [...players].sort((a, b) => {
      const aSubmitted = submitted[a.id] ? 1 : 0
      const bSubmitted = submitted[b.id] ? 1 : 0
      if (aSubmitted !== bSubmitted) return aSubmitted - bSubmitted
      const cmp = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' })
      return sortAsc ? cmp : -cmp
    })
    return sorted
  }, [players, submitted, sortAsc])

  const setAnswer = useCallback(
    (playerId: string, questionId: string, value: string) => {
      setPlayerData((prev) => ({
        ...prev,
        [playerId]: {
          ...prev[playerId],
          answers: { ...prev[playerId].answers, [questionId]: value },
        },
      }))
    },
    []
  )

  const applyGlobalDuration = useCallback(() => {
    if (!globalDuration.trim()) return
    const durationQuestions = survey.questions.filter(
      (q) => q.type === 'SLIDER' || q.type === 'NUMBER'
    )
    if (durationQuestions.length === 0) return

    setPlayerData((prev) => {
      const next = { ...prev }
      for (const pid of Object.keys(next)) {
        if (submitted[pid]) continue
        const answers = { ...next[pid].answers }
        for (const dq of durationQuestions) {
          if (!answers[dq.id]) answers[dq.id] = globalDuration
        }
        next[pid] = { ...next[pid], answers }
      }
      return next
    })
  }, [globalDuration, survey.questions, submitted])

  const openBodyMap = (playerId: string, questionId: string) => {
    setBodyMapPlayerId(playerId)
    setBodyMapQuestionId(questionId)
    setShowBodyMap(true)
  }

  const handleBodyMapClick = (areaId: string, rating: number) => {
    if (!bodyMapPlayerId || !bodyMapQuestionId) return
    setPlayerData((prev) => {
      const pd = prev[bodyMapPlayerId]
      const qData = pd.bodyMapData[bodyMapQuestionId] || {}
      let newQData: Record<string, number>
      if (rating === 0) {
        newQData = { ...qData }
        delete newQData[areaId]
      } else {
        newQData = { ...qData, [areaId]: rating }
      }
      return {
        ...prev,
        [bodyMapPlayerId]: {
          ...pd,
          bodyMapData: { ...pd.bodyMapData, [bodyMapQuestionId]: newQData },
        },
      }
    })
  }

  const submitPlayer = async (playerId: string) => {
    const pd = playerData[playerId]
    if (!pd) return
    const player = players.find((p) => p.id === playerId)
    if (!player) return

    const answers = survey.questions.map((question) => {
      if (question.type === 'BODY_MAP') {
        const bmData = pd.bodyMapData[question.id] || {}
        if (Object.keys(bmData).length > 0) {
          return { questionId: question.id, value: JSON.stringify(bmData) }
        }
        return { questionId: question.id, value: pd.answers[question.id] ?? 'No' }
      }
      return {
        questionId: question.id,
        value: String(pd.answers[question.id] ?? ''),
      }
    })

    setSubmitting((s) => ({ ...s, [playerId]: true }))
    setErrors((e) => {
      const n = { ...e }
      delete n[playerId]
      return n
    })

    try {
      const res = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId: survey.id,
          playerId,
          playerName: `${player.firstName} ${player.lastName}`,
          answers,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      setSubmitted((s) => ({ ...s, [playerId]: true }))
      setPlayerData((prev) => ({
        ...prev,
        [playerId]: { ...prev[playerId], done: true },
      }))
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [playerId]: err instanceof Error ? err.message : 'Failed to submit',
      }))
    } finally {
      setSubmitting((s) => ({ ...s, [playerId]: false }))
    }
  }

  const submitAll = async () => {
    const toSubmit = players.filter((p) => !submitted[p.id] && hasRequiredAnswers(p.id))
    for (const p of toSubmit) {
      await submitPlayer(p.id)
    }
    onRefresh()
  }

  const hasRequiredAnswers = (playerId: string) => {
    const pd = playerData[playerId]
    if (!pd) return false
    for (const q of scaleQuestions) {
      if (q.required && !pd.answers[q.id]) return false
    }
    return true
  }

  const completedCount = Object.values(submitted).filter(Boolean).length
  const totalCount = players.length
  const pendingWithData = players.filter(
    (p) => !submitted[p.id] && hasRequiredAnswers(p.id)
  ).length
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const bodyMapAppearance = surveyThemeFromKiosk(kioskTheme) ?? 'default'

  return (
    <>
      <div className="relative max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* Header bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className={`${activeTheme.secondaryButton} text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all backdrop-blur-sm`}
              >
                ← Player Mode
              </button>
              <h2 className="text-lg sm:text-2xl font-semibold text-white tracking-wide">
                Coach Mode
              </h2>
              <button
                type="button"
                onClick={() => setSortAsc((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-gray-300 transition-all hover:bg-white/10"
                title={sortAsc ? 'Sorted A → Z (click to reverse)' : 'Sorted Z → A (click to reverse)'}
              >
                {sortAsc ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowUpZA className="h-3.5 w-3.5" />}
                {sortAsc ? 'A–Z' : 'Z–A'}
              </button>
            </div>
            {/* Progress bar */}
            <div className="mt-2 flex items-center gap-2.5">
              <div className="h-1.5 flex-1 max-w-[180px] rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">
                <span className="font-semibold text-white">{completedCount}</span>/{totalCount}
              </span>
            </div>
          </div>

          {/* Global Duration */}
          {(sliderQuestions.length > 0 || survey.questions.some((q) => q.type === 'NUMBER')) && (
            <div className="flex items-center gap-2 flex-wrap">
              <Clock className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-300 whitespace-nowrap">Duration:</span>
              <input
                type="number"
                min={1}
                max={300}
                value={globalDuration}
                onChange={(e) => setGlobalDuration(e.target.value)}
                className={`w-20 px-2 py-1.5 rounded-lg text-center text-sm text-white ${activeTheme.inputField}`}
              />
              <span className="text-sm text-gray-400">min</span>
              <button
                type="button"
                onClick={applyGlobalDuration}
                className={`${activeTheme.primaryButton} text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all backdrop-blur-sm`}
              >
                Apply to All
              </button>
            </div>
          )}
        </div>

        {/* Player list */}
        <div className="space-y-1.5 sm:space-y-2">
          {sortedPlayers.map((player) => {
            const pd = playerData[player.id]
            const isSubmitted = submitted[player.id]
            const isSubmitting = submitting[player.id]
            const error = errors[player.id]

            return (
              <div
                key={player.id}
                className={`group/row relative rounded-xl border backdrop-blur-xl px-3 py-2 sm:px-4 sm:py-2.5 transition-all duration-200 ${
                  isSubmitted
                    ? activeTheme.playerCardResponded
                    : activeTheme.playerCardIdle
                } ${isSubmitted ? 'opacity-60' : 'hover:brightness-125 hover:border-white/25'}`}
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
                  {/* Player info */}
                  <div className="flex items-center gap-2.5 lg:w-44 lg:shrink-0">
                    {player.image ? (
                      <Image
                        src={player.image}
                        alt={`${player.firstName} ${player.lastName}`}
                        width={36}
                        height={36}
                        className="h-9 w-9 rounded-full border border-white/20 object-cover shadow"
                      />
                    ) : (
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 shadow ${activeTheme.playerAvatarInitial}`}>
                        <span className="text-xs font-bold" aria-hidden>
                          {(player.firstName?.[0] ?? '').toLocaleUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate leading-tight">
                        {player.firstName}{' '}
                        <span className="font-bold">{player.lastName}</span>
                      </p>
                      {error && (
                        <span className="text-[10px] text-red-300 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {error}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Questions inline */}
                  <div className="flex flex-1 flex-wrap items-center gap-2.5 lg:gap-3">
                    {/* Scale / RPE questions — 1-10 buttons */}
                    {scaleQuestions.map((q) => (
                      <div key={q.id} className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-gray-400 truncate max-w-[140px]">
                          {q.text}
                        </span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                            const selected = pd?.answers[q.id] === String(n)
                            return (
                              <button
                                key={n}
                                type="button"
                                disabled={isSubmitted}
                                onClick={() => setAnswer(player.id, q.id, String(n))}
                                title={RPE_LABELS[n]}
                                className={`relative h-7 w-6 sm:h-8 sm:w-7 rounded text-[11px] sm:text-xs font-bold transition-all border ${
                                  selected
                                    ? `bg-gradient-to-br ${RPE_COLORS[n]} text-white shadow-lg scale-110 z-10`
                                    : `${RPE_IDLE_TINT[n]} hover:brightness-150`
                                } ${isSubmitted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                {n}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Slider / Number questions (training duration) */}
                    {sliderQuestions.concat(textQuestions.filter((q) => q.type === 'NUMBER')).map((q) => (
                      <div key={q.id} className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-gray-400 truncate max-w-[140px]">
                          {q.text}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={999}
                          disabled={isSubmitted}
                          value={pd?.answers[q.id] ?? ''}
                          onChange={(e) => setAnswer(player.id, q.id, e.target.value)}
                          className={`w-16 px-1.5 py-1 rounded-lg text-center text-sm text-white ${activeTheme.inputField} ${isSubmitted ? 'opacity-50' : ''}`}
                        />
                      </div>
                    ))}

                    {/* Boolean questions */}
                    {booleanQuestions.map((q) => (
                      <div key={q.id} className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-gray-400 truncate max-w-[140px]">
                          {q.text}
                        </span>
                        <div className="flex gap-1">
                          {['Yes', 'No'].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              disabled={isSubmitted}
                              onClick={() => setAnswer(player.id, q.id, opt)}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all border ${
                                pd?.answers[q.id] === opt
                                  ? opt === 'Yes'
                                    ? 'bg-red-500/80 border-red-400/60 text-white'
                                    : 'bg-green-500/80 border-green-400/60 text-white'
                                  : 'bg-white/10 border-white/15 text-gray-300 hover:bg-white/20'
                              } ${isSubmitted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Body map questions */}
                    {bodyMapQuestions.map((q) => {
                      const bmData = pd?.bodyMapData[q.id] || {}
                      const areaCount = Object.keys(bmData).length
                      return (
                        <div key={q.id} className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-gray-400 truncate max-w-[140px]">
                            {q.text}
                          </span>
                          <button
                            type="button"
                            disabled={isSubmitted}
                            onClick={() => openBodyMap(player.id, q.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                              areaCount > 0
                                ? 'bg-orange-500/80 border-orange-400/60 text-white'
                                : 'bg-white/10 border-white/15 text-gray-300 hover:bg-white/20'
                            } ${isSubmitted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            {areaCount > 0 ? `${areaCount} area${areaCount > 1 ? 's' : ''}` : 'Body Map'}
                          </button>
                        </div>
                      )
                    })}

                    {/* Text / Time questions */}
                    {textQuestions
                      .filter((q) => q.type !== 'NUMBER')
                      .map((q) => (
                        <div key={q.id} className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-gray-400 truncate max-w-[140px]">
                            {q.text}
                          </span>
                          <input
                            type={q.type === 'TIME' ? 'time' : 'text'}
                            disabled={isSubmitted}
                            value={pd?.answers[q.id] ?? ''}
                            onChange={(e) => setAnswer(player.id, q.id, e.target.value)}
                            className={`w-24 px-1.5 py-1 rounded-lg text-sm text-white ${activeTheme.inputField} ${isSubmitted ? 'opacity-50' : ''}`}
                          />
                        </div>
                      ))}
                  </div>

                  {/* Done indicator / Submit */}
                  <div className="flex items-center gap-2 lg:shrink-0">
                    {isSubmitted ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-green-500/90 to-emerald-500/90 shadow-lg border border-green-400/40">
                        <CheckCircle className="h-4.5 w-4.5 text-white" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isSubmitting || !hasRequiredAnswers(player.id)}
                        onClick={() => submitPlayer(player.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                          hasRequiredAnswers(player.id)
                            ? `${activeTheme.primaryButton} text-white shadow-lg`
                            : 'bg-white/10 border border-white/15 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {isSubmitting ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        {isSubmitting ? 'Saving…' : 'Submit'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom bar — Submit All */}
        <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-2xl border border-white/15 bg-black/60 px-4 py-3 backdrop-blur-xl shadow-2xl sm:px-6">
          <div className="flex items-center gap-3">
            <div className="h-2 w-24 rounded-full bg-white/10 overflow-hidden sm:w-32">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-sm text-gray-300">
              <span className="font-semibold text-white">{completedCount}</span>/{totalCount}
              {pendingWithData > 0 && (
                <span className="ml-2 text-emerald-300">· {pendingWithData} ready</span>
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={pendingWithData === 0}
            onClick={submitAll}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
              pendingWithData > 0
                ? `${activeTheme.primaryButton} text-white shadow-lg`
                : 'bg-white/10 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Send className="h-4 w-4" />
            Submit All ({pendingWithData})
          </button>
        </div>
      </div>

      {/* Body Map Portal */}
      {showBodyMap &&
        bodyMapPlayerId &&
        bodyMapQuestionId &&
        typeof window !== 'undefined' &&
        createPortal(
          <BodyMap
            view={bodyMapView}
            onAreaClick={handleBodyMapClick}
            selectedAreas={
              playerData[bodyMapPlayerId]?.bodyMapData[bodyMapQuestionId] || {}
            }
            onViewChange={setBodyMapView}
            onClose={() => {
              setShowBodyMap(false)
              setBodyMapPlayerId(null)
              setBodyMapQuestionId(null)
            }}
            onContinue={() => {
              setShowBodyMap(false)
              setBodyMapPlayerId(null)
              setBodyMapQuestionId(null)
            }}
            appearanceTheme={bodyMapAppearance}
          />,
          document.body
        )}
    </>
  )
}
