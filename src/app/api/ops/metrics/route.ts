import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import { prisma } from '@/lib/prisma'
import {
  isOpsBaseVariable,
  isOpsMetricKind,
  OPS_BASE_VARIABLES,
  OPS_METRIC_KINDS,
  type FormatRule,
  type OpsMetricConfig,
} from '@/lib/opsMetrics'
import { isOpsRuleOperator } from '@/lib/opsRules'
import { createOpsMetric, listOpsMetrics } from '@/lib/opsMetricsService'
import { ensureOpsSchema } from '@/lib/opsSchemaEnsure'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function parseFormatting(raw: unknown): FormatRule[] {
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

function parseConfig(kind: string, raw: unknown): OpsMetricConfig | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const config: OpsMetricConfig = {}

  if (kind === 'FORMULA') {
    if (typeof o.expression !== 'string' || !o.expression.trim()) return null
    config.expression = o.expression.trim()
    return config
  }

  if (kind === 'COMPOSITE') {
    if (!o.weights || typeof o.weights !== 'object') return null
    const weights: OpsMetricConfig['weights'] = {}
    for (const [k, v] of Object.entries(o.weights as Record<string, unknown>)) {
      if (!isOpsBaseVariable(k)) continue
      const n = Number(v)
      if (!Number.isFinite(n) || n === 0) continue
      weights[k] = n
    }
    if (!Object.keys(weights).length) return null
    config.weights = weights
    return config
  }

  if (!isOpsBaseVariable(o.source)) return null
  config.source = o.source
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
  return config
}

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await ensureOpsSchema()
    const metrics = await listOpsMetrics(session.teamId)
    return NextResponse.json(
      {
        metrics,
        catalog: {
          kinds: OPS_METRIC_KINDS,
          variables: OPS_BASE_VARIABLES,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('Ops metrics GET error:', error)
    return NextResponse.json({ error: 'Failed to load metrics' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await ensureOpsSchema()
    const body = (await request.json().catch(() => null)) as {
      name?: string
      kind?: string
      config?: unknown
      formatting?: unknown
      showInTable?: boolean
      enabled?: boolean
      surveyId?: string | null
    } | null

    if (!body?.name?.trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    if (!isOpsMetricKind(body.kind)) {
      return NextResponse.json({ error: 'invalid kind' }, { status: 400 })
    }
    const config = parseConfig(body.kind, body.config)
    if (!config) {
      return NextResponse.json({ error: 'invalid config for kind' }, { status: 400 })
    }

    let surveyId: string | null = body.surveyId ?? null
    if (surveyId) {
      const owned = await prisma.survey.findFirst({
        where: { id: surveyId, teamId: session.teamId },
        select: { id: true },
      })
      if (!owned) {
        return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
      }
    }

    const metric = await createOpsMetric({
      teamId: session.teamId,
      name: body.name,
      kind: body.kind,
      config,
      formatting: parseFormatting(body.formatting),
      showInTable: body.showInTable ?? true,
      enabled: body.enabled ?? true,
      surveyId,
    })

    return NextResponse.json({ metric }, { status: 201 })
  } catch (error) {
    console.error('Ops metrics POST error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create metric'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
