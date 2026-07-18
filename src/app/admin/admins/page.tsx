'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type TeamInfo = {
  id: string
  name: string
  membershipRole: string
  players: number
  surveys: number
}

type AdminRow = {
  id: string
  email: string
  name: string | null
  role: 'SUPER' | 'TEAM_ADMIN'
  isActive: boolean
  createdAt: string
  teams: TeamInfo[]
}

export default function ManageAdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editTeamName, setEditTeamName] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/auth/admins')
    if (res.status === 403 || res.status === 401) {
      setForbidden(true)
      return
    }
    const data = await res.json()
    setAdmins(data.admins || [])
  }, [])

  useEffect(() => {
    load().catch(() => setError('Failed to load admins'))
  }, [load])

  const startEdit = (a: AdminRow) => {
    setEditingId(a.id)
    setEditName(a.name || '')
    setEditEmail(a.email)
    setEditTeamName(a.teams[0]?.name || '')
    setMessage(null)
    setError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setError(null)
  }

  const saveEdit = async (e: FormEvent, a: AdminRow) => {
    e.preventDefault()
    setBusyId(a.id)
    setError(null)
    setMessage(null)
    try {
      const body: Record<string, string> = {
        name: editName.trim(),
        email: editEmail.trim(),
      }
      if (a.teams[0] && editTeamName.trim()) {
        body.teamName = editTeamName.trim()
        body.teamId = a.teams[0].id
      }
      const res = await fetch(`/api/auth/admins/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Update failed')
        return
      }
      setMessage('Saved')
      setEditingId(null)
      await load()
    } catch {
      setError('Network error')
    } finally {
      setBusyId(null)
    }
  }

  const setActive = async (a: AdminRow, isActive: boolean) => {
    if (a.role === 'SUPER') return
    const label = isActive ? 'unblock' : 'block'
    if (
      !confirm(
        `${label.charAt(0).toUpperCase() + label.slice(1)} ${a.email}? They will ${
          isActive ? 'be able to log in again' : 'not be able to log in'
        }.`,
      )
    ) {
      return
    }
    setBusyId(a.id)
    setError(null)
    try {
      const res = await fetch(`/api/auth/admins/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed')
        return
      }
      setMessage(isActive ? 'Admin unblocked' : 'Admin blocked')
      await load()
    } catch {
      setError('Network error')
    } finally {
      setBusyId(null)
    }
  }

  const removeAdmin = async (a: AdminRow) => {
    if (a.role === 'SUPER') return
    const teamNames = a.teams.map((t) => t.name).join(', ') || 'no team'
    const ok = confirm(
      `DELETE ${a.email}?\n\nThis permanently removes their login AND their team data (${teamNames}: players, surveys, responses).\n\nThis cannot be undone.`,
    )
    if (!ok) return
    const ok2 = confirm('Last confirmation: delete this admin and their entire team?')
    if (!ok2) return

    setBusyId(a.id)
    setError(null)
    try {
      const res = await fetch(`/api/auth/admins/${a.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Delete failed')
        return
      }
      setMessage('Admin and team deleted')
      await load()
    } catch {
      setError('Network error')
    } finally {
      setBusyId(null)
    }
  }

  if (forbidden) {
    return (
      <div className="admin-panel max-w-xl p-8">
        <p className="text-[var(--ad-ink-soft)]">Only the platform super admin can manage admins.</p>
        <Link href="/admin" className="admin-btn admin-btn-ghost mt-4">
          Back to dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="admin-kicker">Platform</p>
          <h1 className="admin-title mt-1">Manage admins</h1>
          <p className="admin-sub">
            Edit, block/unblock login, or permanently delete team admins and their teams.
          </p>
        </div>
        <Link href="/admin/invites" className="admin-btn admin-btn-primary">
          Invite new admin
        </Link>
      </header>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {message}
        </p>
      )}

      <ul className="space-y-4">
        {admins.map((a) => {
          const busy = busyId === a.id
          const editing = editingId === a.id
          return (
            <li key={a.id} className="admin-panel p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--ad-ink)]">
                      {a.name || '—'}{' '}
                      <span className="font-normal text-[var(--ad-muted)]">({a.email})</span>
                    </p>
                    <span
                      className={`admin-badge ${
                        a.role === 'SUPER' ? 'admin-badge-accent' : 'admin-badge-soft'
                      }`}
                    >
                      {a.role === 'SUPER' ? 'Super' : 'Team admin'}
                    </span>
                    <span
                      className={`admin-badge ${a.isActive ? 'admin-badge-ok' : 'admin-badge-warn'}`}
                    >
                      {a.isActive ? 'Active' : 'Blocked'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--ad-muted)]">
                    {a.teams.length === 0
                      ? 'No team'
                      : a.teams
                          .map(
                            (t) =>
                              `${t.name} · ${t.players} players · ${t.surveys} surveys`,
                          )
                          .join(' · ')}
                  </p>
                </div>

                {a.role !== 'SUPER' && !editing && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEdit(a)}
                      className="admin-btn admin-btn-ghost !py-1.5 !text-xs disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setActive(a, !a.isActive)}
                      className="admin-btn admin-btn-warn !py-1.5 !text-xs disabled:opacity-50"
                    >
                      {a.isActive ? 'Block login' : 'Unblock'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeAdmin(a)}
                      className="admin-btn admin-btn-danger !py-1.5 !text-xs disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {editing && (
                <form
                  onSubmit={(e) => saveEdit(e, a)}
                  className="mt-4 grid gap-3 border-t border-[var(--ad-line)] pt-4 sm:grid-cols-2"
                >
                  <div>
                    <label>Name</label>
                    <input
                      value={editName}
                      onChange={(ev) => setEditName(ev.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label>Email</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(ev) => setEditEmail(ev.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                  {a.teams[0] && (
                    <div className="sm:col-span-2">
                      <label>Team name</label>
                      <input
                        value={editTeamName}
                        onChange={(ev) => setEditTeamName(ev.target.value)}
                        required
                        className="mt-1"
                      />
                    </div>
                  )}
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="admin-btn admin-btn-primary disabled:opacity-60"
                    >
                      {busy ? 'Saving…' : 'Save changes'}
                    </button>
                    <button type="button" onClick={cancelEdit} className="admin-btn admin-btn-ghost">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </li>
          )
        })}
      </ul>

      {admins.length === 0 && (
        <p className="text-sm text-[var(--ad-muted)]">No admins found.</p>
      )}
    </div>
  )
}
