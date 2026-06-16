'use client'

import { useState, useCallback, useMemo, type ReactNode } from 'react'
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
  sessionTags?: string[]
  matchDayTags?: string[]
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
  1: 'Very Light',
  2: 'Light',
  3: 'Moderate',
  4: 'Somewhat Hard',
  5: 'Hard',
  6: 'Hard+',
  7: 'Very Hard',
  8: 'Very Hard+',
  9: 'Very Very Hard',
  10: 'Maximal',
}

// Solid accent background per RPE value (used on the roster row accent bar)
const RPE_ACCENT: Record<number, string> = {
  1: 'bg-green-500',
  2: 'bg-green-500',
  3: 'bg-lime-500',
  4: 'bg-yellow-500',
  5: 'bg-amber-500',
  6: 'bg-orange-500',
  7: 'bg-orange-600',
  8: 'bg-red-500',
  9: 'bg-red-600',
  10: 'bg-red-700',
}

export default function CoachModeView({
  survey,
  players,
  kioskTheme,
  sessionTags = [],
  matchDayTags = [],
  onBack,
  onRefresh,
}: CoachModeViewProps) {
  const activeTheme = kioskThemes[kioskTheme] ?? kioskThemes.dark

  const showSession = Boolean(survey.trackSessionType) && sessionTags.length > 0
  const showMatchDay = Boolean(survey.trackMatchDay) && matchDayTags.length > 0

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
  const [globalRpe, setGlobalRpe] = useState<number | null>(null)
  const [globalSession, setGlobalSession] = useState('')
  const [globalMatchDay, setGlobalMatchDay] = useState('')
  const [sessions, setSessions] = useState<Record<string, string>>({})
  const [matchDays, setMatchDays] = useState<Record<string, string>>({})
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
  const [showConfirmAll, setShowConfirmAll] = useState(false)
  const [selectedLetter, setSelectedLetter] = useState('')

  const [showBodyMap, setShowBodyMap] = useState(false)
  const [bodyMapPlayerId, setBodyMapPlayerId] = useState<string | null>(null)
  const [bodyMapQuestionId, setBodyMapQuestionId] = useState<string | null>(null)
  const [bodyMapView, setBodyMapView] = useState<'front' | 'back'>('front')

  const sortedPlayers = useMemo(() => {
    let list = [...players]
    if (selectedLetter) {
      list = list.filter((p) => p.lastName.toUpperCase().startsWith(selectedLetter))
    }
    list.sort((a, b) => {
      const aSubmitted = submitted[a.id] ? 1 : 0
      const bSubmitted = submitted[b.id] ? 1 : 0
      if (aSubmitted !== bSubmitted) return aSubmitted - bSubmitted
      const cmp = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' })
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [players, submitted, sortAsc, selectedLetter])

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

  const applyGlobalRpe = useCallback(() => {
    if (globalRpe === null) return
    if (scaleQuestions.length === 0) return
    setPlayerData((prev) => {
      const next = { ...prev }
      for (const pid of Object.keys(next)) {
        if (submitted[pid]) continue
        const answers = { ...next[pid].answers }
        for (const sq of scaleQuestions) {
          answers[sq.id] = String(globalRpe)
        }
        next[pid] = { ...next[pid], answers }
      }
      return next
    })
  }, [globalRpe, scaleQuestions, submitted])

  const applyGlobalSession = useCallback(() => {
    setSessions(() => {
      const next: Record<string, string> = {}
      for (const p of players) {
        if (submitted[p.id]) continue
        next[p.id] = globalSession
      }
      return next
    })
  }, [globalSession, players, submitted])

  const applyGlobalMatchDay = useCallback(() => {
    setMatchDays(() => {
      const next: Record<string, string> = {}
      for (const p of players) {
        if (submitted[p.id]) continue
        next[p.id] = globalMatchDay
      }
      return next
    })
  }, [globalMatchDay, players, submitted])

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
          ...(showSession && sessions[playerId] ? { sessionType: sessions[playerId] } : {}),
          ...(showMatchDay && matchDays[playerId] ? { matchDay: matchDays[playerId] } : {}),
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

  const confirmAndSubmitAll = () => {
    setShowConfirmAll(true)
  }

  const executeSubmitAll = async () => {
    setShowConfirmAll(false)
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

  type GridCol = {
    id: string
    label: string
    width: string
    cell: (player: PlayerWithStatus) => ReactNode
  }

  const durationQuestionsForGrid = sliderQuestions.concat(
    textQuestions.filter((q) => q.type === 'NUMBER')
  )
  const textTimeQuestions = textQuestions.filter((q) => q.type !== 'NUMBER')

  const gridColumns: GridCol[] = [
    {
      id: 'player',
      label: 'Player',
      width: '208px',
      cell: (player) => {
        const pd = playerData[player.id]
        const error = errors[player.id]
        const primaryRpe =
          scaleQuestions[0] && pd?.answers[scaleQuestions[0].id]
            ? Number(pd.answers[scaleQuestions[0].id])
            : null
        return (
          <div className="flex items-center gap-2.5">
            <span
              className={`h-10 w-1.5 shrink-0 rounded-full ${primaryRpe ? RPE_ACCENT[primaryRpe] : 'bg-white/10'}`}
              aria-hidden
            />
            {player.image ? (
              <Image
                src={player.image}
                alt={`${player.firstName} ${player.lastName}`}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full border border-white/20 object-cover shadow"
              />
            ) : (
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 shadow ${activeTheme.playerAvatarInitial}`}>
                <span className="text-sm font-bold" aria-hidden>
                  {(player.firstName?.[0] ?? '').toLocaleUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {player.firstName} <span className="font-bold">{player.lastName}</span>
              </p>
              {error && (
                <span className="text-[10px] text-red-300 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {error}
                </span>
              )}
            </div>
          </div>
        )
      },
    },
    ...scaleQuestions.map((q) => ({
      id: q.id,
      label: q.text,
      width: '404px',
      cell: (player: PlayerWithStatus) => {
        const pd = playerData[player.id]
        const isSubmitted = submitted[player.id]
        const selectedVal = pd?.answers[q.id] ? Number(pd.answers[q.id]) : null
        return (
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const selected = selectedVal === n
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={isSubmitted}
                    onClick={() => setAnswer(player.id, q.id, String(n))}
                    title={RPE_LABELS[n]}
                    className={`relative h-9 w-7 rounded-md text-xs font-bold transition-all border ${
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
            <span className="inline-flex w-[96px] shrink-0">
              {selectedVal && RPE_LABELS[selectedVal] && (
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-white bg-gradient-to-br ${RPE_COLORS[selectedVal]} border whitespace-nowrap`}>
                  {RPE_LABELS[selectedVal]}
                </span>
              )}
            </span>
          </div>
        )
      },
    })),
    ...durationQuestionsForGrid.map((q) => ({
      id: q.id,
      label: 'Duration',
      width: '104px',
      cell: (player: PlayerWithStatus) => {
        const pd = playerData[player.id]
        const isSubmitted = submitted[player.id]
        return (
          <input
            type="number"
            min={0}
            max={999}
            disabled={isSubmitted}
            value={pd?.answers[q.id] ?? ''}
            onChange={(e) => setAnswer(player.id, q.id, e.target.value)}
            className={`h-9 w-16 px-1.5 rounded-lg text-center text-xs text-white ${activeTheme.inputField} ${isSubmitted ? 'opacity-50' : ''}`}
          />
        )
      },
    })),
    ...booleanQuestions.map((q) => ({
      id: q.id,
      label: q.text,
      width: '108px',
      cell: (player: PlayerWithStatus) => {
        const pd = playerData[player.id]
        const isSubmitted = submitted[player.id]
        return (
          <div className="flex gap-1">
            {['Yes', 'No'].map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={isSubmitted}
                onClick={() => setAnswer(player.id, q.id, opt)}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all border ${
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
        )
      },
    })),
    ...bodyMapQuestions.map((q) => ({
      id: q.id,
      label: q.text,
      width: '112px',
      cell: (player: PlayerWithStatus) => {
        const pd = playerData[player.id]
        const isSubmitted = submitted[player.id]
        const bmData = pd?.bodyMapData[q.id] || {}
        const areaCount = Object.keys(bmData).length
        return (
          <button
            type="button"
            disabled={isSubmitted}
            onClick={() => openBodyMap(player.id, q.id)}
            className={`px-3 py-2 rounded-lg text-[11px] font-semibold transition-all border ${
              areaCount > 0
                ? 'bg-orange-500/80 border-orange-400/60 text-white'
                : 'bg-white/10 border-white/15 text-gray-300 hover:bg-white/20'
            } ${isSubmitted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {areaCount > 0 ? `${areaCount} area${areaCount > 1 ? 's' : ''}` : 'Body Map'}
          </button>
        )
      },
    })),
    ...textTimeQuestions.map((q) => ({
      id: q.id,
      label: q.text,
      width: '132px',
      cell: (player: PlayerWithStatus) => {
        const pd = playerData[player.id]
        const isSubmitted = submitted[player.id]
        return (
          <input
            type={q.type === 'TIME' ? 'time' : 'text'}
            disabled={isSubmitted}
            value={pd?.answers[q.id] ?? ''}
            onChange={(e) => setAnswer(player.id, q.id, e.target.value)}
            className={`h-9 w-full px-1.5 rounded-lg text-xs text-white ${activeTheme.inputField} ${isSubmitted ? 'opacity-50' : ''}`}
          />
        )
      },
    })),
    ...(showSession
      ? [{
          id: 'session',
          label: 'Session',
          width: '116px',
          cell: (player: PlayerWithStatus) => {
            const isSubmitted = submitted[player.id]
            return (
              <select
                disabled={isSubmitted}
                value={sessions[player.id] ?? ''}
                onChange={(e) => setSessions((prev) => ({ ...prev, [player.id]: e.target.value }))}
                className={`h-9 w-full px-1.5 rounded-lg text-xs text-white ${activeTheme.inputField} ${isSubmitted ? 'opacity-50' : ''}`}
              >
                <option value="">—</option>
                {sessionTags.map((t) => (
                  <option key={t} value={t} className="text-black">{t}</option>
                ))}
              </select>
            )
          },
        }]
      : []),
    ...(showMatchDay
      ? [{
          id: 'matchday',
          label: 'Match Day',
          width: '116px',
          cell: (player: PlayerWithStatus) => {
            const isSubmitted = submitted[player.id]
            return (
              <select
                disabled={isSubmitted}
                value={matchDays[player.id] ?? ''}
                onChange={(e) => setMatchDays((prev) => ({ ...prev, [player.id]: e.target.value }))}
                className={`h-9 w-full px-1.5 rounded-lg text-xs text-white ${activeTheme.inputField} ${isSubmitted ? 'opacity-50' : ''}`}
              >
                <option value="">—</option>
                {matchDayTags.map((t) => (
                  <option key={t} value={t} className="text-black">{t}</option>
                ))}
              </select>
            )
          },
        }]
      : []),
    {
      id: 'action',
      label: '',
      width: '132px',
      cell: (player) => {
        const isSubmitted = submitted[player.id]
        const isSubmitting = submitting[player.id]
        if (isSubmitted) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-green-500/90 to-emerald-500/90 px-3 py-1 text-xs font-semibold text-white shadow border border-green-400/40">
              <CheckCircle className="h-3.5 w-3.5" /> Done
            </span>
          )
        }
        return (
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
        )
      },
    },
  ]

  const gridTemplate = gridColumns.map((c) => c.width).join(' ')

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

          {/* Global presets */}
          <div className="flex flex-col gap-2 sm:items-end">
            {/* Global RPE */}
            {scaleQuestions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-gray-300 whitespace-nowrap">RPE:</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setGlobalRpe(n)}
                      title={RPE_LABELS[n]}
                      className={`h-7 w-6 rounded text-[11px] font-bold transition-all border ${
                        globalRpe === n
                          ? `bg-gradient-to-br ${RPE_COLORS[n]} text-white shadow-lg scale-110 z-10`
                          : `${RPE_IDLE_TINT[n]} hover:brightness-150 cursor-pointer`
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={globalRpe === null}
                  onClick={applyGlobalRpe}
                  className={`${globalRpe !== null ? activeTheme.primaryButton + ' text-white shadow' : 'bg-white/10 text-gray-500 cursor-not-allowed'} px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all backdrop-blur-sm`}
                >
                  Apply to All
                </button>
              </div>
            )}
            {/* Global Duration */}
            {(sliderQuestions.length > 0 || survey.questions.some((q) => q.type === 'NUMBER')) && (
              <div className="flex items-center gap-2 flex-wrap">
                <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-300 whitespace-nowrap">Duration:</span>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={globalDuration}
                  onChange={(e) => setGlobalDuration(e.target.value)}
                  className={`w-16 px-2 py-1 rounded-lg text-center text-sm text-white ${activeTheme.inputField}`}
                />
                <span className="text-xs text-gray-400">min</span>
                <button
                  type="button"
                  onClick={applyGlobalDuration}
                  className={`${activeTheme.primaryButton} text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all backdrop-blur-sm`}
                >
                  Apply to All
                </button>
              </div>
            )}
            {/* Global Session Type */}
            {showSession && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-300 whitespace-nowrap">Session:</span>
                <select
                  value={globalSession}
                  onChange={(e) => setGlobalSession(e.target.value)}
                  className={`h-7 px-2 py-0.5 rounded-lg text-xs text-white ${activeTheme.inputField}`}
                >
                  <option value="">—</option>
                  {sessionTags.map((t) => (
                    <option key={t} value={t} className="text-black">
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={applyGlobalSession}
                  className={`${activeTheme.primaryButton} text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all backdrop-blur-sm`}
                >
                  Apply to All
                </button>
              </div>
            )}
            {/* Global Match Day */}
            {showMatchDay && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-300 whitespace-nowrap">Match Day:</span>
                <select
                  value={globalMatchDay}
                  onChange={(e) => setGlobalMatchDay(e.target.value)}
                  className={`h-7 px-2 py-0.5 rounded-lg text-xs text-white ${activeTheme.inputField}`}
                >
                  <option value="">—</option>
                  {matchDayTags.map((t) => (
                    <option key={t} value={t} className="text-black">
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={applyGlobalMatchDay}
                  className={`${activeTheme.primaryButton} text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all backdrop-blur-sm`}
                >
                  Apply to All
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Alphabet filter */}
        <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-3">
          <button
            type="button"
            onClick={() => setSelectedLetter('')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              !selectedLetter
                ? `${activeTheme.primaryButton} text-white shadow`
                : 'bg-white/10 border border-white/15 text-gray-300 hover:bg-white/20'
            }`}
          >
            All
          </button>
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => {
            const hasPlayers = players.some((p) => p.lastName.toUpperCase().startsWith(letter))
            return (
              <button
                key={letter}
                type="button"
                disabled={!hasPlayers}
                onClick={() => setSelectedLetter(letter)}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedLetter === letter
                    ? `${activeTheme.primaryButton} text-white shadow`
                    : hasPlayers
                    ? 'bg-white/10 border border-white/15 text-gray-300 hover:bg-white/20'
                    : 'bg-white/5 border border-white/5 text-gray-600 cursor-not-allowed'
                }`}
              >
                {letter}
              </button>
            )
          })}
        </div>

        {/* Roster grid */}
        <div className="overflow-x-auto -mx-3 px-3 pb-2 sm:mx-0 sm:px-0">
          <div className="min-w-max">
            {/* Column header */}
            <div
              className="grid items-end gap-x-3 px-2.5 pb-2"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {gridColumns.map((col) => (
                <div
                  key={col.id}
                  className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400"
                  title={col.label}
                >
                  {col.label}
                </div>
              ))}
            </div>

            {/* Player rows */}
            <div className="space-y-2">
              {sortedPlayers.map((player) => {
                const isSubmitted = submitted[player.id]
                return (
                  <div
                    key={player.id}
                    className={`grid items-center gap-x-3 rounded-xl border px-2.5 py-3 backdrop-blur-xl transition-all duration-200 ${
                      isSubmitted ? activeTheme.playerCardResponded : activeTheme.playerCardIdle
                    } ${isSubmitted ? 'opacity-60' : 'hover:brightness-125 hover:border-white/25'}`}
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {gridColumns.map((col) => (
                      <div key={col.id} className="min-w-0">
                        {col.cell(player)}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
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
            onClick={confirmAndSubmitAll}
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

      {/* Confirm Submit All Modal */}
      {showConfirmAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`relative ${activeTheme.modalBackground} backdrop-blur-xl rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6`}>
            <div className={`absolute inset-0 ${activeTheme.modalOverlay} rounded-2xl`} />
            <div className="relative">
              <h3 className="text-xl font-semibold text-white mb-2">Confirm Submission</h3>
              <div className={`w-12 h-0.5 ${activeTheme.accentLine} rounded-full mb-4`} />
              <p className="text-sm text-gray-300 mb-6">
                Submit survey data for{' '}
                <span className="font-bold text-white">{pendingWithData} player{pendingWithData !== 1 ? 's' : ''}</span>?
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={executeSubmitAll}
                  className={`flex-1 ${activeTheme.primaryButton} text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all`}
                >
                  Yes, Submit All
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmAll(false)}
                  className={`flex-1 ${activeTheme.adminButton} text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
