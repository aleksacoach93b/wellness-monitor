'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Syne, DM_Sans } from 'next/font/google'
import '../admin.css'

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

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Login failed')
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

  return (
    <div className={`${syne.variable} ${dmSans.variable} admin-auth`}>
      <div className="admin-auth-inner">
        <div className="admin-auth-brand">
          <span className="admin-auth-mark" aria-hidden />
          <p className="admin-auth-product">Wellness Monitor</p>
        </div>

        <div className="admin-auth-card">
          <h1>Welcome back</h1>
          <p className="admin-auth-lead">
            Sign in with your email and password. New clubs join by invite only.
          </p>

          <form onSubmit={onSubmit} className="admin-auth-form">
            <div className="admin-auth-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@club.com"
              />
            </div>
            <div className="admin-auth-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="admin-auth-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="admin-auth-submit">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="admin-auth-foot">Staff access · invite-only for new teams</p>
      </div>
    </div>
  )
}
