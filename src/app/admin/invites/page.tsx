'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Copy, Check } from 'lucide-react'

type InviteRow = {
  id: string
  email: string
  status: string
  expiresAt: string
  suggestedTeamName: string | null
  acceptedTeam?: { id: string; name: string } | null
}

export default function AdminInvitesPage() {
  const [email, setEmail] = useState('')
  const [suggestedTeamName, setSuggestedTeamName] = useState('')
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [lastUrl, setLastUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/auth/invite')
    if (res.status === 403 || res.status === 401) {
      setForbidden(true)
      return
    }
    const data = await res.json()
    setInvites(data.invites || [])
  }, [])

  useEffect(() => {
    load().catch(() => setError('Failed to load invites'))
  }, [load])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLastUrl(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          suggestedTeamName: suggestedTeamName.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to create invite')
        return
      }
      setLastUrl(data.inviteUrl)
      setEmail('')
      setSuggestedTeamName('')
      await load()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const copyUrl = async () => {
    if (!lastUrl) return
    await navigator.clipboard.writeText(lastUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (forbidden) {
    return (
      <div className="admin-panel max-w-xl p-8">
        <p className="text-[var(--ad-ink-soft)]">Only the platform super admin can send invites.</p>
        <Link href="/admin" className="admin-btn admin-btn-ghost mt-4">
          Back to dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="admin-kicker">Platform</p>
          <h1 className="admin-title mt-1">Invite admins</h1>
          <p className="admin-sub">
            Invite-only. They set their own password and create their own team — isolated from yours.
          </p>
        </div>
        <Link href="/admin/admins" className="admin-btn admin-btn-ghost">
          Manage admins
        </Link>
      </header>

      <form onSubmit={onCreate} className="admin-panel space-y-4 p-5 sm:p-6">
        <div>
          <label htmlFor="invite-email">Email</label>
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="invite-team">Suggested team name (optional)</label>
          <input
            id="invite-team"
            value={suggestedTeamName}
            onChange={(e) => setSuggestedTeamName(e.target.value)}
            className="mt-1"
          />
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <button type="submit" disabled={loading} className="admin-btn admin-btn-primary disabled:opacity-60">
          {loading ? 'Creating…' : 'Create invite link'}
        </button>
      </form>

      {lastUrl && (
        <div className="admin-panel border-teal-200/70 bg-teal-50/50 p-5">
          <p className="text-sm font-semibold text-teal-950">Invite link (send this)</p>
          <p className="mt-2 break-all font-mono text-xs text-teal-950/90">{lastUrl}</p>
          <button type="button" onClick={copyUrl} className="admin-btn admin-btn-ghost mt-3 !text-teal-900">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}

      <div className="admin-panel p-5 sm:p-6">
        <h2 className="admin-kicker !normal-case !tracking-wide">Recent invites</h2>
        <ul className="mt-3 divide-y divide-[var(--ad-line)]">
          {invites.length === 0 && (
            <li className="py-3 text-sm text-[var(--ad-muted)]">No invites yet</li>
          )}
          {invites.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-semibold text-[var(--ad-ink)]">{inv.email}</p>
                <p className="text-xs text-[var(--ad-muted)]">
                  {inv.status}
                  {inv.acceptedTeam ? ` · ${inv.acceptedTeam.name}` : ''}
                  {' · '}
                  expires {new Date(inv.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`admin-badge ${
                  inv.status === 'ACCEPTED'
                    ? 'admin-badge-ok'
                    : inv.status === 'PENDING'
                      ? 'admin-badge-accent'
                      : 'admin-badge-soft'
                }`}
              >
                {inv.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
