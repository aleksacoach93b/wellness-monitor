'use client'
import { useEffect, useRef, useId } from 'react'
import {
  Check,
  ChevronRight,
  Cloud,
  CloudOff,
  Loader2,
  X,
  AlertCircle,
  WifiOff,
} from 'lucide-react'
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
export function SurveyDraftStatus({
  locale,
  draftStatus,
  restored,
  online,
}: {
  locale: KioskLocale
  draftStatus: string
  restored: boolean
  online: boolean
}) {
  return (
    <section className="sj-draft" aria-label={t(locale, 'journeyCheckIn')}>
      <div className="sj-draft-top">
        <strong>{t(locale, 'journeyCheckIn')}</strong>
        <span className="sj-draft-status" role="status">
          {draftStatus === 'saving' ? (
            <Loader2 size={15} className="animate-spin" />
          ) : draftStatus === 'saved' ? (
            <Check size={15} />
          ) : (
            <CloudOff size={15} />
          )}
          <span>
            {t(
              locale,
              draftStatus === 'saved'
                ? 'journeyDraftSaved'
                : draftStatus === 'saving'
                  ? 'journeyDraftSaving'
                  : 'journeyKeepOpen',
            )}
          </span>
        </span>
      </div>
      {(restored || !online) && (
        <p>
          {[
            restored ? t(locale, 'journeyRestored') : '',
            !online ? t(locale, 'journeyOffline') : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
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
      <div className="sj-review-content">
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
      </div>
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

export function SurveyDelivery({
  open,
  sending,
  online,
  durable,
  attention,
  repeat,
  locale,
  appearance,
  buttonClass,
  onDismiss,
  onRetry,
  onEdit,
}: {
  open: boolean
  sending: boolean
  online: boolean
  durable: boolean
  attention: boolean
  repeat?: 'focus' | 'rhr'
  locale: KioskLocale
  appearance: string
  buttonClass: string
  onDismiss: () => void
  onRetry: () => void
  onEdit: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])
  const message = sending
    ? 'journeyProcessing'
    : attention
      ? 'journeyReviewNeeded'
      : online
        ? 'journeySendInterrupted'
        : 'journeyConnectionWait'
  return (
    <dialog
      ref={dialog}
      data-appearance={appearance}
      className="sj-delivery-dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      onCancel={(e) => {
        if (sending) e.preventDefault()
        else onDismiss()
      }}
      onClose={onDismiss}
    >
      <div className="sj-delivery-symbol" aria-hidden="true">
        {sending ? (
          <Loader2 className="animate-spin" size={30} />
        ) : attention ? (
          <AlertCircle size={30} />
        ) : (
          <WifiOff size={30} />
        )}
      </div>
      <h2 id={titleId}>{t(locale, message)}</h2>
      {!sending && (
        <p>
          {t(
            locale,
            attention
              ? repeat === 'focus'
                ? 'journeyRepeatFocus'
                : repeat === 'rhr'
                  ? 'journeyRepeatRhr'
                  : 'journeyCheckAnswers'
              : !durable
                ? 'journeyKeepPageOpen'
                : 'journeyAnswersKept',
          )}
        </p>
      )}
      {!sending && (
        <div className="sj-delivery-dialog-actions">
          <button type="button" className="sj-secondary" onClick={onDismiss}>
            {t(locale, 'journeyDismiss')}
          </button>
          <button
            type="button"
            className={`sj-primary ${buttonClass}`}
            disabled={!attention && !online}
            onClick={attention ? onEdit : onRetry}
          >
            {t(locale, attention ? 'journeyReview' : 'journeyRetryShort')}
          </button>
        </div>
      )}
    </dialog>
  )
}
