import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import { prisma } from '@/lib/prisma'
import {
  isOpsBaseVariable,
  isOpsMetricKind,
  type FormatRule,
  type OpsMetricConfig,
} from '@/lib/opsMetrics'
import { isOpsRuleOperator } from '@/lib/opsRules'
import { deleteOpsMetric, updateOpsMetric } from '@/lib/opsMetricsService'
import { ensureOpsSchema } from '@/lib/opsSchemaEnsure'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function parseFormatting(raw: unknown): FormatRule[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) return []
  const out: FormatRule[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const operator = (row as { operator?: unknown }).operator
    const threshold = Number((row as { threshold?: unknown }).threshold)
    const color = (row as { color?: unknown }).color
    if (!isOpsRuleOperator(operator)) continue
    if (!Number.isFinite(threshold)) continue
    if (typeof color !== 'string' || !color.trim()) continue
    out.push({ operator, threshold, color: color.trim() })
  }
  return out
}

function parseConfig(kind: string | undefined, raw: unknown): OpsMetricConfig | undefined {
  if (raw === undefined) return undefined
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const config: OpsMetricConfig = {}
  const k = kind

  if (k === 'FORMULA' || typeof o.expression === 'string') {
    if (typeof o.expression === 'string') config.expression = o.expression.trim()
  }
  if (isOpsBaseVariable(o.source)) config.source = o.source
  if (typeof o.alpha === 'number' && Number.isFinite(o.alpha)) config.alpha = o.alpha
  if (typeof o.windowDays === 'number' && Number.isFinite(o.windowDays)) {
    config.windowDays = o.windowDays
  }
  if (typeof o.acuteDays === 'number' && Number.isFinite(o.acuteDays)) {
    config.acuteDays = o.acuteDays
  }
  if (typeof o.chronicDays === 'number' && Number.isFinite(o.chronicDays)) {
    config.chronicDays = o.chronicDays
  }
  if (typeof o.spikePct === 'number' && Number.isFinite(o.spikePct)) {
    config.spikePct = o.spikePct
  }
  if (o.weights && typeof o.weights === 'object') {
    const weights: OpsMetricConfig['weights'] = {}
    for (const [key, v] of Object.entries(o.weights as Record<string, unknown>)) {
      if (!isOpsBaseVariable(key)) continue
      const n = Number(v)
      if (!Number.isFinite(n)) continue
      weights[key] = n
    }
    config.weights = weights
  }
  return config
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await ensureOpsSchema()
    const { id } = await ctx.params
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const kind = isOpsMetricKind(body.kind) ? body.kind : undefined
    if (body.surveyId) {
      const owned = await prisma.survey.findFirst({
        where: { id: String(body.surveyId), teamId: session.teamId },
        select: { id: true },
      })
      if (!owned) {
        return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
      }
    }

    const nextConfig =
      body.config !== undefined ? parseConfig(kind, body.config) : undefined
    const nextFormatting =
      body.formatting !== undefined ? parseFormatting(body.formatting) : undefined

    const metric = await updateOpsMetric({
      teamId: session.teamId,
      id,
      patch: {
        ...(typeof body.name === 'string' ? { name: body.name } : {}),
        ...(kind ? { kind } : {}),
        ...(nextConfig ? { config: nextConfig } : {}),
        ...(nextFormatting ? { formatting: nextFormatting } : {}),
        ...(typeof body.showInTable === 'boolean' ? { showInTable: body.showInTable } : {}),
        ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
        ...(body.surveyId !== undefined
          ? { surveyId: body.surveyId ? String(body.surveyId) : null }
          : {}),
      },
    })

    if (!metric) {
      return NextResponse.json({ error: 'Metric not found' }, { status: 404 })
    }
    return NextResponse.json({ metric })
  } catch (error) {
    console.error('Ops metrics PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update metric' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSessionFromRequest(_request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await ensureOpsSchema()
    const { id } = await ctx.params
    const ok = await deleteOpsMetric(session.teamId, id)
    if (!ok) {
      return NextResponse.json({ error: 'Metric not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Ops metrics DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete metric' }, { status: 500 })
  }
}
