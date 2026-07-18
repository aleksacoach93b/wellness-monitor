'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Syne, DM_Sans } from 'next/font/google'
import '../../admin.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['600', '700', '800'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
})

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params.token

  const [email, setEmail] = useState('')
  const [suggestedTeamName, setSuggestedTeamName] = useState('')
  const [name, setName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/auth/invite/${token}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) setError(data.error || 'Invite is invalid')
          return
        }
        if (!cancelled) {
          setEmail(data.email || '')
          setSuggestedTeamName(data.suggestedTeamName || '')
          setTeamName(data.suggestedTeamName || '')
        }
      } catch {
        if (!cancelled) setError('Failed to load invite')
      } finally {
        if (!cancelled) setBooting(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, teamName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to accept invite')
        return
      }
      router.replace('/admin')
      router.refresh()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (booting) {
    return (
      <div className={`${syne.variable} ${dmSans.variable} admin-auth`}>
        <p className="admin-auth-foot">Loading invite…</p>
      </div>
    )
  }

  return (
    <div className={`${syne.variable} ${dmSans.variable} admin-auth`}>
      <div className="admin-auth-inner">
        <div className="admin-auth-brand">
          <span className="admin-auth-mark" aria-hidden />
          <p className="admin-auth-product">Wellness Monitor</p>
        </div>

        <div className="admin-auth-card">
          <h1>Create your account</h1>
          <p className="admin-auth-lead">
            Set your password and team. Your data stays isolated from other clubs.
          </p>

          {error && !email ? (
            <p className="admin-auth-error mt-6">{error}</p>
          ) : (
            <form onSubmit={onSubmit} className="admin-auth-form">
              <div className="admin-auth-field">
                <label>Email</label>
                <input value={email} readOnly className="opacity-80" />
              </div>
              <div className="admin-auth-field">
                <label>Your name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="admin-auth-field">
                <label>Team name</label>
                <input
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder={suggestedTeamName || 'e.g. U19 Academy'}
                />
              </div>
              <div className="admin-auth-field">
                <label>Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="admin-auth-field">
                <label>Confirm password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              {error && (
                <p className="admin-auth-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="admin-auth-submit">
                {loading ? 'Creating…' : 'Create account & team'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
