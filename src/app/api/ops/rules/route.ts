import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import { prisma } from '@/lib/prisma'
import {
  isOpsRuleMetric,
  isOpsRuleOperator,
  isOpsRuleSeverity,
  OPS_RULE_METRICS,
  OPS_RULE_OPERATORS,
  OPS_RULE_SEVERITIES,
} from '@/lib/opsRules'
import { createOpsRule, ensureDefaultOpsRules } from '@/lib/opsRulesService'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rules = await ensureDefaultOpsRules(session.teamId)
    return NextResponse.json(
      {
        rules,
        catalog: {
          metrics: OPS_RULE_METRICS,
          operators: OPS_RULE_OPERATORS,
          severities: OPS_RULE_SEVERITIES,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('Ops rules GET error:', error)
    return NextResponse.json({ error: 'Failed to load rules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      name?: string
      metric?: string
      operator?: string
      threshold?: number
      severity?: string
      enabled?: boolean
      surveyId?: string | null
    } | null

    if (!body?.name?.trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    if (!isOpsRuleMetric(body.metric)) {
      return NextResponse.json({ error: 'invalid metric' }, { status: 400 })
    }
    if (!isOpsRuleOperator(body.operator)) {
      return NextResponse.json({ error: 'invalid operator' }, { status: 400 })
    }
    const severity = body.severity ?? 'WATCH'
    if (!isOpsRuleSeverity(severity)) {
      return NextResponse.json({ error: 'invalid severity' }, { status: 400 })
    }
    const threshold = Number(body.threshold)
    if (!Number.isFinite(threshold)) {
      return NextResponse.json({ error: 'invalid threshold' }, { status: 400 })
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

    const rule = await createOpsRule({
      teamId: session.teamId,
      name: body.name,
      metric: body.metric,
      operator: body.operator,
      threshold,
      severity,
      enabled: body.enabled ?? true,
      surveyId,
    })

    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    console.error('Ops rules POST error:', error)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }
}
