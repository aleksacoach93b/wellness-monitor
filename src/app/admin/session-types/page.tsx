'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react'

interface Tag {
  id: string
  name: string
  category: 'SESSION' | 'MATCHDAY'
  order: number
  isActive: boolean
}

const CATEGORIES = [
  {
    key: 'SESSION' as const,
    title: 'Session Types',
    blurb: 'e.g. Gym, Pitch, Rehab. Shown when filling in RPE so each session can be tagged.',
    accent: 'blue',
    placeholder: 'e.g. Gym',
  },
  {
    key: 'MATCHDAY' as const,
    title: 'Match Day',
    blurb: 'e.g. MD, MD-1, MD+1. Optional label for where the day sits in the match week.',
    accent: 'violet',
    placeholder: 'e.g. MD-1',
  },
]

export default function SessionTypesPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newName, setNewName] = useState<Record<string, string>>({ SESSION: '', MATCHDAY: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [busy, setBusy] = useState(false)

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags?all=true')
      if (res.ok) setTags(await res.json())
    } catch (e) {
      console.error('Failed to load tags', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  const addTag = async (category: 'SESSION' | 'MATCHDAY') => {
    const name = (newName[category] || '').trim()
    if (!name || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category }),
      })
      if (res.ok) {
        setNewName((p) => ({ ...p, [category]: '' }))
        await fetchTags()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to add')
      }
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = async (id: string) => {
    const name = editingName.trim()
    if (!name) return
    setBusy(true)
    try {
      const res = await fetch(`/api/tags/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        setEditingId(null)
        setEditingName('')
        await fetchTags()
      }
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (tag: Tag) => {
    setBusy(true)
    try {
      await fetch(`/api/tags/${tag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !tag.isActive }),
      })
      await fetchTags()
    } finally {
      setBusy(false)
    }
  }

  const deleteTag = async (tag: Tag) => {
    if (!confirm(`Delete "${tag.name}"? Past responses already saved keep their label.`)) return
    setBusy(true)
    try {
      await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' })
      await fetchTags()
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="admin-kicker">Training</p>
        <h1 className="admin-title mt-1">Session tags</h1>
        <p className="admin-sub">
          Manage the tags coaches and players can pick from. Enable them per survey from the
          survey&apos;s edit page (Track Session Type / Track Match Day).
        </p>
      </header>

      <div className="space-y-6">
        {CATEGORIES.map((cat) => {
          const items = tags
            .filter((t) => t.category === cat.key)
            .sort((a, b) => a.order - b.order)
          return (
            <div key={cat.key} className="admin-panel p-5 sm:p-6">
              <h2 className="admin-display text-lg font-bold text-[var(--ad-ink)]">{cat.title}</h2>
              <p className="mb-4 text-sm text-[var(--ad-muted)]">{cat.blurb}</p>

              <div className="space-y-2 mb-4">
                {items.length === 0 && (
                  <p className="text-sm text-gray-400 italic">No tags yet.</p>
                )}
                {items.map((tag) => (
                  <div
                    key={tag.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                      tag.isActive ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-gray-50/50 opacity-60'
                    }`}
                  >
                    {editingId === tag.id ? (
                      <>
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(tag.id)}
                          className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                        <button
                          onClick={() => saveEdit(tag.id)}
                          className="p-1.5 rounded text-green-600 hover:bg-green-50"
                          title="Save"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null)
                            setEditingName('')
                          }}
                          className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={`flex-1 text-sm font-medium ${tag.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                          {tag.name}
                        </span>
                        <button
                          onClick={() => toggleActive(tag)}
                          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100"
                          title={tag.isActive ? 'Hide from pickers' : 'Show in pickers'}
                        >
                          {tag.isActive ? 'Active' : 'Hidden'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(tag.id)
                            setEditingName(tag.name)
                          }}
                          className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
                          title="Rename"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteTag(tag)}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={newName[cat.key]}
                  onChange={(e) => setNewName((p) => ({ ...p, [cat.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addTag(cat.key)}
                  placeholder={cat.placeholder}
                  className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <button
                  onClick={() => addTag(cat.key)}
                  disabled={busy || !(newName[cat.key] || '').trim()}
                  className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
