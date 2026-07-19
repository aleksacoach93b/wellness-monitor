import { prisma } from '@/lib/prisma'
import { ensureOpsSchema } from '@/lib/opsSchemaEnsure'
import {
  DEFAULT_OPS_RULES,
  evaluateOpsRules,
  isOpsRuleMetric,
  isOpsRuleOperator,
  isOpsRuleSeverity,
  type EvaluatedHit,
  type OpsInterventionDTO,
  type OpsRuleDTO,
  type OpsRuleMetric,
  type OpsRuleOperator,
  type OpsRuleSeverity,
} from '@/lib/opsRules'
import { parseCustomRuleMetric } from '@/lib/opsMetrics'

function mapRule(row: {
  id: string
  teamId: string
  surveyId: string | null
  name: string
  metric: string
  operator: string
  threshold: number
  severity: string
  enabled: boolean
  sortOrder: number
}): OpsRuleDTO | null {
  const customKey = parseCustomRuleMetric(row.metric)
  const metricOk = isOpsRuleMetric(row.metric) || !!customKey
  if (!metricOk) return null
  if (!isOpsRuleOperator(row.operator)) return null
  if (!isOpsRuleSeverity(row.severity)) return null
  return {
    id: row.id,
    teamId: row.teamId,
    surveyId: row.surveyId,
    name: row.name,
    metric: row.metric as OpsRuleMetric,
    operator: row.operator,
    threshold: row.threshold,
    severity: row.severity,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  }
}

/** Ensure team has at least the default starter rules (editable afterwards). */
export async function ensureDefaultOpsRules(teamId: string): Promise<OpsRuleDTO[]> {
  try {
    await ensureOpsSchema()
    const existing = await prisma.opsRule.count({ where: { teamId } })
    if (existing === 0) {
      await prisma.opsRule.createMany({
        data: DEFAULT_OPS_RULES.map((r, i) => ({
          teamId,
          surveyId: null,
          name: r.name,
          metric: r.metric,
          operator: r.operator,
          threshold: r.threshold,
          severity: r.severity,
          enabled: r.enabled,
          sortOrder: i,
        })),
      })
    }
    return listOpsRules(teamId)
  } catch (error) {
    console.error('ensureDefaultOpsRules failed:', error)
    try {
      await ensureOpsSchema()
      return listOpsRules(teamId)
    } catch (retryError) {
      console.error('ensureDefaultOpsRules retry failed:', retryError)
      return []
    }
  }
}

export async function listOpsRules(teamId: string): Promise<OpsRuleDTO[]> {
  try {
    await ensureOpsSchema()
    const rows = await prisma.opsRule.findMany({
      where: { teamId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return rows.map(mapRule).filter((r): r is OpsRuleDTO => !!r)
  } catch (error) {
    console.error('listOpsRules failed:', error)
    return []
  }
}

export async function createOpsRule(args: {
  teamId: string
  name: string
  metric: OpsRuleMetric | string
  operator: OpsRuleOperator
  threshold: number
  severity: OpsRuleSeverity
  enabled?: boolean
  surveyId?: string | null
}): Promise<OpsRuleDTO> {
  await ensureOpsSchema()
  const count = await prisma.opsRule.count({ where: { teamId: args.teamId } })
  const row = await prisma.opsRule.create({
    data: {
      teamId: args.teamId,
      surveyId: args.surveyId ?? null,
      name: args.name.trim() || 'Custom rule',
      metric: args.metric,
      operator: args.operator,
      threshold: args.threshold,
      severity: args.severity,
      enabled: args.enabled ?? true,
      sortOrder: count,
    },
  })
  const mapped = mapRule(row)
  if (!mapped) throw new Error('Invalid rule created')
  return mapped
}

export async function updateOpsRule(args: {
  teamId: string
  id: string
  patch: Partial<{
    name: string
    metric: OpsRuleMetric | string
    operator: OpsRuleOperator
    threshold: number
    severity: OpsRuleSeverity
    enabled: boolean
    surveyId: string | null
  }>
}): Promise<OpsRuleDTO | null> {
  await ensureOpsSchema()
  const owned = await prisma.opsRule.findFirst({
    where: { id: args.id, teamId: args.teamId },
    select: { id: true },
  })
  if (!owned) return null
  const row = await prisma.opsRule.update({
    where: { id: args.id },
    data: {
      ...(args.patch.name != null ? { name: args.patch.name.trim() || 'Custom rule' } : {}),
      ...(args.patch.metric != null ? { metric: args.patch.metric } : {}),
      ...(args.patch.operator != null ? { operator: args.patch.operator } : {}),
      ...(args.patch.threshold != null ? { threshold: args.patch.threshold } : {}),
      ...(args.patch.severity != null ? { severity: args.patch.severity } : {}),
      ...(args.patch.enabled != null ? { enabled: args.patch.enabled } : {}),
      ...(args.patch.surveyId !== undefined ? { surveyId: args.patch.surveyId } : {}),
    },
  })
  return mapRule(row)
}

export async function deleteOpsRule(teamId: string, id: string): Promise<boolean> {
  await ensureOpsSchema()
  const owned = await prisma.opsRule.findFirst({
    where: { id, teamId },
    select: { id: true },
  })
  if (!owned) return false
  await prisma.opsRule.delete({ where: { id } })
  return true
}

type PlayerRow = {
  id: string
  firstName: string
  lastName: string
  status: 'done' | 'pending'
  wellness: {
    readiness: number | null
    fatigue: { value: number | null }
    soreness: { value: number | null }
    sleepQuality: { value: number | null }
    mood: { value: number | null }
    stress: { value: number | null }
    risk: { sleep: boolean }
    pain: { max: number | null; hasData: boolean }
  } | null
  derived?: Array<{ key: string; value: number | null }>
}

/**
 * Evaluate rules for the day, upsert open hits, auto-resolve stale opens.
 * Never throws to the caller of Live Ops.
 */
export async function syncOpsInterventions(args: {
  teamId: string
  surveyId: string | null
  date: string
  players: PlayerRow[]
}): Promise<OpsInterventionDTO[]> {
  try {
    await ensureOpsSchema()
    const rules = await ensureDefaultOpsRules(args.teamId)
    const hits = evaluateOpsRules({
      players: args.players,
      rules,
      surveyId: args.surveyId,
    })

    const hitKeys = new Set(hits.map((h) => `${h.ruleId}:${h.playerId}`))

    for (const hit of hits) {
      const existing = await prisma.opsIntervention.findUnique({
        where: {
          ruleId_playerId_date: {
            ruleId: hit.ruleId,
            playerId: hit.playerId,
            date: args.date,
          },
        },
        select: { id: true, status: true },
      })

      if (!existing) {
        await prisma.opsIntervention.create({
          data: {
            teamId: args.teamId,
            surveyId: args.surveyId,
            ruleId: hit.ruleId,
            playerId: hit.playerId,
            date: args.date,
            severity: hit.severity,
            metric: hit.metric,
            value: hit.value,
            message: hit.message,
            status: 'OPEN',
          },
        })
        continue
      }

      // Keep coach acknowledgement; re-open only if it was resolved/cleared.
      const nextStatus =
        existing.status === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'OPEN'

      await prisma.opsIntervention.update({
        where: { id: existing.id },
        data: {
          surveyId: args.surveyId,
          severity: hit.severity,
          metric: hit.metric,
          value: hit.value,
          message: hit.message,
          status: nextStatus,
          resolvedAt: nextStatus === 'OPEN' ? null : undefined,
        },
      })
    }

    // Auto-resolve opens for this day that no longer match.
    const openRows = await prisma.opsIntervention.findMany({
      where: {
        teamId: args.teamId,
        date: args.date,
        status: 'OPEN',
        ...(args.surveyId ? { OR: [{ surveyId: args.surveyId }, { surveyId: null }] } : {}),
      },
      select: { id: true, ruleId: true, playerId: true },
    })
    const staleIds = openRows
      .filter((r) => !hitKeys.has(`${r.ruleId}:${r.playerId}`))
      .map((r) => r.id)
    if (staleIds.length) {
      await prisma.opsIntervention.updateMany({
        where: { id: { in: staleIds } },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      })
    }

    return listOpsInterventions({
      teamId: args.teamId,
      date: args.date,
      surveyId: args.surveyId,
    })
  } catch (error) {
    console.error('syncOpsInterventions failed:', error)
    // Fallback: return in-memory hits without persistence
    try {
      const rules = await listOpsRules(args.teamId)
      const hits = evaluateOpsRules({
        players: args.players,
        rules: rules.length ? rules : DEFAULT_OPS_RULES.map((r, i) => ({
          id: `tmp-${i}`,
          teamId: args.teamId,
          surveyId: null,
          sortOrder: i,
          ...r,
        })),
        surveyId: args.surveyId,
      })
      return hitsToDto(hits, args)
    } catch {
      return []
    }
  }
}

function hitsToDto(
  hits: EvaluatedHit[],
  args: { teamId: string; surveyId: string | null; date: string },
): OpsInterventionDTO[] {
  const now = new Date().toISOString()
  return hits.map((h, i) => ({
    id: `ephemeral-${i}`,
    teamId: args.teamId,
    surveyId: args.surveyId,
    ruleId: h.ruleId,
    ruleName: h.ruleName,
    playerId: h.playerId,
    playerName: h.playerName,
    date: args.date,
    severity: h.severity,
    metric: h.metric,
    value: h.value,
    message: h.message,
    status: 'OPEN',
    note: null,
    createdAt: now,
    updatedAt: now,
  }))
}

export async function listOpsInterventions(args: {
  teamId: string
  date: string
  surveyId?: string | null
  includeResolved?: boolean
}): Promise<OpsInterventionDTO[]> {
  try {
    const rows = await prisma.opsIntervention.findMany({
      where: {
        teamId: args.teamId,
        date: args.date,
        ...(args.includeResolved ? {} : { status: { in: ['OPEN', 'ACKNOWLEDGED'] } }),
        ...(args.surveyId
          ? { OR: [{ surveyId: args.surveyId }, { surveyId: null }] }
          : {}),
      },
      include: {
        rule: { select: { name: true } },
      },
      orderBy: [{ severity: 'asc' }, { updatedAt: 'desc' }],
    })

    // Attach player names
    const playerIds = [...new Set(rows.map((r) => r.playerId))]
    const players = playerIds.length
      ? await prisma.player.findMany({
          where: { id: { in: playerIds }, teamId: args.teamId },
          select: { id: true, firstName: true, lastName: true },
        })
      : []
    const nameById = new Map(
      players.map((p) => [p.id, `${p.firstName} ${p.lastName}`.trim()]),
    )

    const severityRank = { CRITICAL: 0, ALERT: 1, WATCH: 2 } as const
    const mapped = rows
      .map((r) => {
        if (!isOpsRuleMetric(r.metric) || !isOpsRuleSeverity(r.severity)) return null
        const status = r.status as OpsInterventionDTO['status']
        if (!['OPEN', 'ACKNOWLEDGED', 'RESOLVED'].includes(status)) return null
        return {
          id: r.id,
          teamId: r.teamId,
          surveyId: r.surveyId,
          ruleId: r.ruleId,
          ruleName: r.rule.name,
          playerId: r.playerId,
          playerName: nameById.get(r.playerId) || 'Unknown',
          date: r.date,
          severity: r.severity,
          metric: r.metric,
          value: r.value,
          message: r.message,
          status,
          note: r.note,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        } satisfies OpsInterventionDTO
      })
      .filter((r): r is OpsInterventionDTO => !!r)

    return mapped.sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        a.playerName.localeCompare(b.playerName),
    )
  } catch (error) {
    console.error('listOpsInterventions failed:', error)
    return []
  }
}

export async function setInterventionStatus(args: {
  teamId: string
  id: string
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
  note?: string | null
}): Promise<OpsInterventionDTO | null> {
  const owned = await prisma.opsIntervention.findFirst({
    where: { id: args.id, teamId: args.teamId },
    select: { id: true, date: true, surveyId: true },
  })
  if (!owned) return null

  await prisma.opsIntervention.update({
    where: { id: args.id },
    data: {
      status: args.status,
      note: args.note === undefined ? undefined : args.note,
      acknowledgedAt: args.status === 'ACKNOWLEDGED' ? new Date() : undefined,
      resolvedAt: args.status === 'RESOLVED' ? new Date() : null,
    },
  })

  const list = await listOpsInterventions({
    teamId: args.teamId,
    date: owned.date,
    surveyId: owned.surveyId,
    includeResolved: true,
  })
  return list.find((i) => i.id === args.id) ?? null
}
