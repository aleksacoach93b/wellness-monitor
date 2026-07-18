'use client'

import { useState } from 'react'
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { kioskThemes, kioskTextTokens, type KioskTheme } from '@/lib/kioskThemes'
import KioskClubBrand from '@/components/KioskClubBrand'

interface KioskPasswordPromptProps {
  onPasswordCorrect: () => void
  onCancel?: () => void
  /** Matches kiosk player screen; from `/api/kiosk-settings` when available */
  theme?: KioskTheme
  clubName?: string | null
  clubLogo?: string | null
  showClubBranding?: boolean
  /** Scopes settings to the survey's team (multi-admin) */
  surveyId?: string
  /** When already loaded via bootstrap — skip an extra settings round-trip */
  expectedPassword?: string | null
}

export default function KioskPasswordPrompt({
  onPasswordCorrect,
  onCancel,
  theme = 'dark',
  clubName,
  clubLogo,
  showClubBranding = true,
  surveyId,
  expectedPassword,
}: KioskPasswordPromptProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const activeTheme = kioskThemes[theme] ?? kioskThemes.dark
  const text = kioskTextTokens(theme)
  const hasCode = Boolean(password.trim())
  const hasBrand = showClubBranding && Boolean(clubName?.trim() || clubLogo?.trim())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password.trim()) {
      setError('Please enter the password')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (typeof expectedPassword === 'string') {
        if (password.trim() === expectedPassword) {
          onPasswordCorrect()
        } else {
          setError('Incorrect password. Please try again.')
        }
        return
      }

      const qs = surveyId ? `?surveyId=${encodeURIComponent(surveyId)}` : ''
      const response = await fetch(`/api/kiosk-settings${qs}`)
      if (response.ok) {
        const settings = await response.json()

        if (password.trim() === settings?.password) {
          onPasswordCorrect()
        } else {
          setError('Incorrect password. Please try again.')
        }
      } else {
        setError('Unable to verify password. Please try again.')
      }
    } catch (err) {
      console.error('Error verifying password:', err)
      setError('Unable to verify password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen ${activeTheme.rootBackground} relative overflow-hidden flex items-center justify-center p-4`}>
      <div className={`pointer-events-none absolute inset-0 ${activeTheme.overlayOne}`} aria-hidden />
      <div
        className={`pointer-events-none absolute inset-0 ${activeTheme.overlayTwo}`}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md">
        <div
          className={`relative rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden ${activeTheme.modalBackground} border`}
        >
          <div className={`absolute inset-0 ${activeTheme.modalOverlay} rounded-3xl pointer-events-none`} aria-hidden />

          <div className="relative px-8 pt-10 pb-8 sm:px-10 sm:py-12">
            <div className="text-center mb-8">
              {hasBrand ? (
                <div className="mb-8">
                  <KioskClubBrand
                    clubName={clubName}
                    clubLogo={clubLogo}
                    showBranding={showClubBranding}
                    kioskTheme={theme}
                    size="lg"
                    align="center"
                    logoOnly
                  />
                </div>
              ) : (
                <div className="relative mx-auto w-24 h-24 mb-8">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/25 via-white/10 to-transparent blur-xl scale-125" aria-hidden />
                  <div
                    className={`relative flex h-full w-full items-center justify-center rounded-full shadow-2xl border border-white/10 ${activeTheme.primaryButton}`}
                  >
                    <Lock className="w-11 h-11 text-white drop-shadow-md" strokeWidth={1.75} />
                  </div>
                </div>
              )}

              <h1 className={`text-3xl sm:text-4xl font-light ${text.textStrong} tracking-wide mb-3 drop-shadow-lg`}>
                Survey Access
              </h1>
              <div className={`h-1 w-20 mx-auto rounded-full mb-5 ${activeTheme.accentLine}`} />
              <p className={`${text.textSoft} text-base sm:text-lg font-medium tracking-wide leading-relaxed px-2`}>
                Enter the access code to open the kiosk
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className={`block text-sm font-semibold ${text.textSoft} mb-3 tracking-wide`}>
                  Access Code
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full px-5 py-4 pr-14 rounded-xl text-lg tracking-wide backdrop-blur-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/25 transition-all duration-200 ${activeTheme.inputField}`}
                    placeholder="Enter access code"
                    disabled={loading}
                    autoFocus
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg ${text.textFaint} hover:opacity-70 hover:bg-black/5 transition-colors`}
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-3 p-4 rounded-xl border border-red-500/40 bg-red-950/50 backdrop-blur-sm"
                >
                  <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-red-100 font-medium text-sm leading-snug">{error}</span>
                </div>
              )}

              <div className="space-y-3 pt-1">
                <button
                  type="submit"
                  disabled={loading || !hasCode}
                  className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-lg font-semibold transition-all duration-300 shadow-xl backdrop-blur-sm border ${
                    loading || !hasCode
                      ? `${activeTheme.secondaryButton} text-white/45 cursor-not-allowed opacity-80`
                      : `${activeTheme.primaryButton} text-white transform hover:scale-[1.02] active:scale-[0.99]`
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/30 border-t-white" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Start Survey
                    </>
                  )}
                </button>
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={loading}
                    className={`w-full flex items-center justify-center px-6 py-3.5 rounded-xl text-base font-semibold transition-all duration-300 backdrop-blur-sm border ${activeTheme.adminButton} text-white disabled:opacity-50`}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <p className="mt-8 text-center text-sm text-gray-500 leading-relaxed">
              Contact your coach if you don&apos;t have the access code
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
