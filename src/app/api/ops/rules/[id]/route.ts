import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import { prisma } from '@/lib/prisma'
import {
  isOpsRuleMetric,
  isOpsRuleOperator,
  isOpsRuleSeverity,
} from '@/lib/opsRules'
import { deleteOpsRule, updateOpsRule } from '@/lib/opsRulesService'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

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

    const patch: Parameters<typeof updateOpsRule>[0]['patch'] = {}
    if (body?.name != null) patch.name = body.name
    if (body?.metric != null) {
      if (!isOpsRuleMetric(body.metric)) {
        return NextResponse.json({ error: 'invalid metric' }, { status: 400 })
      }
      patch.metric = body.metric
    }
    if (body?.operator != null) {
      if (!isOpsRuleOperator(body.operator)) {
        return NextResponse.json({ error: 'invalid operator' }, { status: 400 })
      }
      patch.operator = body.operator
    }
    if (body?.threshold != null) {
      const threshold = Number(body.threshold)
      if (!Number.isFinite(threshold)) {
        return NextResponse.json({ error: 'invalid threshold' }, { status: 400 })
      }
      patch.threshold = threshold
    }
    if (body?.severity != null) {
      if (!isOpsRuleSeverity(body.severity)) {
        return NextResponse.json({ error: 'invalid severity' }, { status: 400 })
      }
      patch.severity = body.severity
    }
    if (body?.enabled != null) patch.enabled = Boolean(body.enabled)
    if (body && 'surveyId' in body) {
      const surveyId = body.surveyId ?? null
      if (surveyId) {
        const owned = await prisma.survey.findFirst({
          where: { id: surveyId, teamId: session.teamId },
          select: { id: true },
        })
        if (!owned) {
          return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
        }
      }
      patch.surveyId = surveyId
    }

    const rule = await updateOpsRule({
      teamId: session.teamId,
      id,
      patch,
    })
    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }
    return NextResponse.json({ rule })
  } catch (error) {
    console.error('Ops rules PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSessionFromRequest(_request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  try {
    const ok = await deleteOpsRule(session.teamId, id)
    if (!ok) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Ops rules DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}
