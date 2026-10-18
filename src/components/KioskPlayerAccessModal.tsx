'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import {
  kioskThemes,
  kioskTextTokens,
  type KioskTheme,
} from '@/lib/kioskThemes'
import { t, type KioskLocale } from '@/lib/i18n'
import { useSurveyViewport } from '@/components/survey/useSurveyViewport'

/** One modal stays mounted from initials entry until the survey route commits. */
export default function KioskPlayerAccessModal({
  player,
  busy,
  theme,
  locale,
  onCancel,
  children,
}: {
  player: { firstName: string; lastName: string; image: string | null }
  busy: boolean
  theme: KioskTheme
  locale: KioskLocale
  onCancel: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const viewport = useSurveyViewport()
  const activeTheme = kioskThemes[theme] ?? kioskThemes.dark
  const text = kioskTextTokens(theme)
  const fullName = `${player.firstName} ${player.lastName}`
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [])
  useEffect(() => {
    if (busy) dialog.current?.focus()
  }, [busy])
  return (
    <div ref={viewport}>
      <dialog
        ref={dialog}
        aria-label={fullName}
        aria-busy={busy}
        tabIndex={-1}
        onCancel={(e) => {
          e.preventDefault()
          if (!busy) onCancel()
        }}
        className={`kiosk-player-access ${activeTheme.modalBackground} backdrop:bg-black/60 backdrop:backdrop-blur-sm backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-2xl w-[calc(100vw-2rem)] max-w-md focus:outline-none`}
        style={{
          position: 'fixed',
          left: '50%',
          top: 'calc(var(--sj-viewport-top, 0px) + var(--sj-viewport-height, 100dvh) / 2)',
          right: 'auto',
          bottom: 'auto',
          margin: 0,
          transform: 'translate(-50%, -50%)',
          maxHeight: 'calc(var(--sj-viewport-height, 100dvh) - 24px)',
          overflowY: 'auto',
        }}
      >
        <div
          className={`absolute inset-0 ${activeTheme.modalOverlay} rounded-2xl pointer-events-none`}
          aria-hidden="true"
        />
        <div className="relative">
          <div className="text-center mb-5">
            {player.image ? (
              <Image
                src={player.image}
                alt={fullName}
                width={80}
                height={80}
                className="h-16 w-16 mx-auto rounded-full object-cover border-2 border-white/20 mb-3"
              />
            ) : (
              <div
                aria-hidden="true"
                className={`h-16 w-16 mx-auto mb-3 rounded-full grid place-items-center text-2xl font-semibold ${activeTheme.playerAvatarInitial}`}
              >
                {(player.firstName || player.lastName)
                  .slice(0, 1)
                  .toLocaleUpperCase()}
              </div>
            )}
            <p className={`text-lg font-semibold ${text.textStrong}`}>
              {fullName}
            </p>
          </div>
          {busy ? (
            <div className="py-5 text-center" role="status" aria-live="polite">
              <div
                className={`w-12 h-12 mx-auto mb-4 rounded-full grid place-items-center ${activeTheme.secondaryButton}`}
              >
                <Loader2
                  aria-hidden="true"
                  size={24}
                  className={`animate-spin ${text.textStrong}`}
                />
              </div>
              <p className={`text-lg font-medium ${text.textStrong}`}>
                {t(locale, 'loadingSurvey')}
              </p>
            </div>
          ) : (
            children
          )}
        </div>
      </dialog>
    </div>
  )
}
