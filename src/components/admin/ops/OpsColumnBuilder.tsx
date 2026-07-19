'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, RotateCcw, Settings2 } from 'lucide-react'
import {
  DEFAULT_OPS_COLUMNS,
  isMappableColumn,
  metaFor,
  normalizeOpsColumns,
  type OpsColumnConfig,
  type OpsSurveyQuestion,
} from '@/lib/opsTableColumns'

type Props = {
  columns: OpsColumnConfig[]
  questions: OpsSurveyQuestion[]
  onChange: (next: OpsColumnConfig[]) => void
  saving?: boolean
  surveyTitle?: string | null
}

export default function OpsColumnBuilder({
  columns,
  questions,
  onChange,
  saving,
  surveyTitle,
}: Props) {
  const [open, setOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const normalized = useMemo(() => normalizeOpsColumns(columns), [columns])
  const enabledCount = normalized.filter((c) => c.enabled).length
  const mappedCount = normalized.filter((c) => c.questionId).length

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const patch = (id: string, patchRow: Partial<OpsColumnConfig>) => {
    onChange(
      normalized.map((c) => (c.id === id ? { ...c, ...patchRow } : c)),
    )
  }

  const move = (index: number, dir: -1 | 1) => {
    const next = [...normalized]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    if (next[index].id === 'athlete' || next[target].id === 'athlete') return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const toggle = (id: string) => {
    const meta = metaFor(id as OpsColumnConfig['id'])
    if (meta.required) return
    patch(id, { enabled: !normalized.find((c) => c.id === id)?.enabled })
  }

  const onDragStart = (id: string) => {
    if (id === 'athlete') return
    setDragId(id)
  }

  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault()
    if (!dragId || dragId === overId || overId === 'athlete' || dragId === 'athlete') return
    const from = normalized.findIndex((c) => c.id === dragId)
    const to = normalized.findIndex((c) => c.id === overId)
    if (from < 0 || to < 0 || from === to) return
    const next = [...normalized]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  const onDragEnd = () => setDragId(null)

  return (
    <div className="ops-col-builder" ref={panelRef}>
      <button
        type="button"
        className={`ops-col-builder-toggle${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Settings2 className="h-3.5 w-3.5" />
        Customize columns
        <span className="ops-col-builder-count">
          {enabledCount}/{normalized.length}
        </span>
        {mappedCount > 0 ? (
          <span className="ops-col-builder-count is-map">{mappedCount} mapped</span>
        ) : null}
        {saving ? <em className="ops-col-builder-saving">Saving…</em> : null}
      </button>

      {open ? (
        <div className="ops-col-builder-panel ops-col-builder-panel-wide">
          <header className="ops-col-builder-head">
            <div>
              <strong>Your monitoring layout</strong>
              <p>
                Toggle, rename headers, and map each metric to the full survey question
                {surveyTitle ? (
                  <>
                    {' '}
                    for <b>{surveyTitle}</b>
                  </>
                ) : null}
                . Saved for this account on this team + survey.
              </p>
            </div>
            <button
              type="button"
              className="ops-col-builder-reset"
              onClick={() => onChange(DEFAULT_OPS_COLUMNS)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </header>

          <ul className="ops-col-builder-list">
            {normalized.map((col, index) => {
              const meta = metaFor(col.id)
              const mappable = isMappableColumn(col.id)
              return (
                <li
                  key={col.id}
                  className={`ops-col-builder-item${col.enabled ? ' is-on' : ''}${
                    dragId === col.id ? ' is-dragging' : ''
                  }`}
                  draggable={!meta.required}
                  onDragStart={() => onDragStart(col.id)}
                  onDragOver={(e) => onDragOver(e, col.id)}
                  onDragEnd={onDragEnd}
                >
                  <span className="ops-col-builder-grip" aria-hidden>
                    <GripVertical className="h-3.5 w-3.5" />
                  </span>
                  <div className="ops-col-builder-main">
                    <label className="ops-col-builder-check">
                      <input
                        type="checkbox"
                        checked={col.enabled}
                        disabled={meta.required}
                        onChange={() => toggle(col.id)}
                      />
                      <span>
                        <b>{meta.label}</b>
                        <small>
                          {meta.group}
                          {meta.description ? ` · ${meta.description}` : ''}
                        </small>
                      </span>
                    </label>

                    <div className="ops-col-builder-fields">
                      <label className="ops-col-builder-field">
                        <span>Table header</span>
                        <input
                          type="text"
                          value={col.label ?? ''}
                          placeholder={meta.label}
                          onChange={(e) =>
                            patch(col.id, {
                              label: e.target.value.trim() ? e.target.value : null,
                            })
                          }
                        />
                      </label>

                      {mappable ? (
                        <label className="ops-col-builder-field">
                          <span>Survey question (full title)</span>
                          <select
                            value={col.questionId ?? ''}
                            onChange={(e) =>
                              patch(col.id, {
                                questionId: e.target.value || null,
                              })
                            }
                          >
                            <option value="">Auto-detect by question text</option>
                            {questions.map((q) => (
                              <option key={q.id} value={q.id}>
                                {q.text}
                                {q.type ? `  ·  ${q.type}` : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <p className="ops-col-builder-note">
                          {col.id === 'sleepRisk'
                            ? 'Derived from sleep quality — no question map.'
                            : 'System column — not mapped to a survey question.'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="ops-col-builder-move">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={
                        index === 0 ||
                        col.id === 'athlete' ||
                        normalized[index - 1]?.id === 'athlete'
                      }
                      onClick={() => move(index, -1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === normalized.length - 1 || col.id === 'athlete'}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
