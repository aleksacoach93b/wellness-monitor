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
      <div className="mx-auto max-w-2xl p-8">
        <p className="text-slate-700">Only the platform super admin can send invites.</p>
        <Link href="/admin" className="mt-4 inline-block text-sm text-sky-700 underline">
          Back to admin
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6 sm:p-8">
      <div>
        <Link href="/admin" className="text-sm text-slate-600 hover:text-slate-900">
          ← Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Invite team admins</h1>
        <p className="mt-1 text-sm text-slate-600">
          Invite-only. They will set their own password and create their own team (players, surveys,
          exports). They cannot see Football Club data.
        </p>
      </div>

      <form onSubmit={onCreate} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">
            Suggested team name (optional)
          </label>
          <input
            value={suggestedTeamName}
            onChange={(e) => setSuggestedTeamName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Creating…' : 'Create invite link'}
        </button>
      </form>

      {lastUrl && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">Invite link (send this)</p>
          <p className="mt-2 break-all font-mono text-xs text-emerald-950">{lastUrl}</p>
          <button
            type="button"
            onClick={copyUrl}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent invites</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {invites.length === 0 && (
            <li className="py-3 text-sm text-slate-500">No invites yet</li>
          )}
          {invites.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">{inv.email}</p>
                <p className="text-xs text-slate-500">
                  {inv.status}
                  {inv.acceptedTeam ? ` · ${inv.acceptedTeam.name}` : ''}
                  {' · '}
                  expires {new Date(inv.expiresAt).toLocaleDateString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
