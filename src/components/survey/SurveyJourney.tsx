'use client'
import { useEffect, useRef, useId } from 'react'
import { Check, ChevronRight, Cloud, CloudOff, Loader2, X } from 'lucide-react'
import { t, tx, type KioskLocale } from '@/lib/i18n'
import { parsePvtAnswer } from '@/lib/pvt/options'
import { isRhrQuestion, parseRhrAnswer } from '@/lib/rhr/options'
import { countCompleteBodyMapAreas } from '@/lib/bodyMapPainLocation'
export type ReviewQuestion = {
  id: string
  text: string
  type: string
  required: boolean
  options?: string | null
}
export function reviewValue(
  q: ReviewQuestion,
  value: string | string[] | undefined,
  locale: KioskLocale,
) {
  if (Array.isArray(value)) return value.map((v) => tx(locale, v)).join(', ')
  if (!value?.trim()) return t(locale, 'journeyUnanswered')
  if (q.type === 'MULTIPLE_SELECT') {
    try {
      const values = JSON.parse(value)
      return Array.isArray(values) && values.length
        ? values.map((v) => tx(locale, String(v))).join(', ')
        : t(locale, 'journeyUnanswered')
    } catch {
      return t(locale, 'journeyUnanswered')
    }
  }
  if (q.type === 'PVT') {
    const a = parsePvtAnswer(value)
    return a
      ? a.medianRT == null
        ? t(locale, 'completed')
        : `${Math.round(a.medianRT)} ms`
      : t(locale, 'journeyUnanswered')
  }
  if (isRhrQuestion(q)) {
    const a = parseRhrAnswer(value)
    return a ? `${a.bpm} bpm · ${a.position}` : t(locale, 'journeyUnanswered')
  }
  if (q.type === 'BODY_MAP' && value !== 'No' && value !== 'Yes') {
    try {
      const count = countCompleteBodyMapAreas(JSON.parse(value))
      return `${count} ${t(locale, count === 1 ? 'area' : 'areas')}`
    } catch {
      return t(locale, 'journeyUnanswered')
    }
  }
  return tx(locale, value)
}
export function JourneyProgress({
  answered,
  total,
  missing,
  locale,
  draftStatus,
  restored,
  online,
}: {
  answered: number
  total: number
  missing: number
  locale: KioskLocale
  draftStatus: string
  restored: boolean
  online: boolean
}) {
  return (
    <section className="sj-progress" aria-label={t(locale, 'journeyProgress')}>
      <div className="sj-progress-top">
        <div>
          <p>{t(locale, 'journeyCheckIn')}</p>
          <strong>
            {answered} / {total} <span>{t(locale, 'journeyAnswered')}</span>
          </strong>
        </div>
        <span className="sj-draft-status" role="status">
          {draftStatus === 'saving' ? (
            <Loader2 size={15} className="animate-spin" />
          ) : draftStatus === 'saved' ? (
            <Check size={15} />
          ) : (
            <CloudOff size={15} />
          )}
          <span>
            {draftStatus === 'saved'
              ? t(locale, 'journeyDraftSaved')
              : draftStatus === 'saving'
                ? t(locale, 'journeyDraftSaving')
                : t(locale, 'journeyKeepOpen')}
          </span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t(locale, 'journeyProgress')}
        aria-valuenow={answered}
        aria-valuemin={0}
        aria-valuemax={total || 1}
        className="sj-progress-track"
      >
        <i style={{ width: `${total ? (100 * answered) / total : 0}%` }} />
      </div>
      <p className="sj-progress-note">
        {missing
          ? `${missing} ${t(locale, 'journeyRequiredLeft')}`
          : t(locale, 'journeyReadyReview')}
        {restored ? ` · ${t(locale, 'journeyRestored')}` : ''}
        {!online ? ` · ${t(locale, 'journeyOffline')}` : ''}
      </p>
    </section>
  )
}
export function SurveyReview({
  appearance,
  open,
  onClose,
  onConfirm,
  onEdit,
  questions,
  answers,
  playerName,
  surveyTitle,
  tags,
  locale,
  submitting,
  buttonClass,
}: {
  appearance: string
  open: boolean
  onClose: () => void
  onConfirm: () => void
  onEdit: (id: string) => void
  questions: ReviewQuestion[]
  answers: { questionId: string; value: string }[]
  playerName: string
  surveyTitle: string
  tags: string[]
  locale: KioskLocale
  submitting: boolean
  buttonClass: string
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId()
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])
  return (
    <dialog
      ref={dialog}
      data-appearance={appearance}
      className="sj-review"
      aria-labelledby={titleId}
      onCancel={(e) => {
        if (submitting) e.preventDefault()
        else onClose()
      }}
      onClose={onClose}
    >
      <header>
        <div>
          <p>{tx(locale, surveyTitle)}</p>
          <h2 id={titleId}>{t(locale, 'journeyReview')}</h2>
          <span>
            {playerName}
            {tags.length ? ` · ${tags.join(' · ')}` : ''}
          </span>
        </div>
        <button
          type="button"
          aria-label={t(locale, 'cancel')}
          disabled={submitting}
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </header>
      <p className="sj-review-copy">{t(locale, 'journeyReviewHint')}</p>
      <ol>
        {questions.map((q, i) => (
          <li key={q.id}>
            <div>
              <span>
                {i + 1}. {tx(locale, q.text)}
                {!q.required ? ` · ${t(locale, 'optional')}` : ''}
              </span>
              <strong>
                {reviewValue(
                  q,
                  answers.find((a) => a.questionId === q.id)?.value,
                  locale,
                )}
              </strong>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={() => onEdit(q.id)}
              aria-label={`${t(locale, 'journeyEdit')}: ${tx(locale, q.text)}`}
            >
              {t(locale, 'journeyEdit')}
              <ChevronRight size={15} />
            </button>
          </li>
        ))}
      </ol>
      <footer>
        <button
          type="button"
          className="sj-secondary"
          onClick={onClose}
          disabled={submitting}
        >
          {t(locale, 'journeyBack')}
        </button>
        <button
          type="button"
          className={`sj-primary ${buttonClass}`}
          onClick={onConfirm}
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Cloud size={18} />
          )}{' '}
          {t(locale, 'submitSurvey')}
        </button>
      </footer>
    </dialog>
  )
}
