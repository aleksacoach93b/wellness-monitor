'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import '../../admin.css'

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
      <div className="admin-auth">
        <p className="text-white/70">Loading invite…</p>
      </div>
    )
  }

  return (
    <div className="admin-auth">
      <div className="admin-auth-card">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-300/90">
          Wellness Monitor
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Create your admin account</h1>
        <p className="mt-2 text-sm text-white/60">
          Set your own password and team. Your data stays isolated from other clubs.
        </p>

        {error && !email ? (
          <p className="mt-6 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div>
              <label>Email</label>
              <input value={email} readOnly className="mt-1 opacity-80" />
            </div>
            <div>
              <label>Your name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label>Team name</label>
              <input
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder={suggestedTeamName || 'e.g. U19 Academy'}
                className="mt-1"
              />
            </div>
            <div>
              <label>Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label>Confirm password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="admin-btn admin-btn-primary !w-full !py-3 disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create account & team'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
