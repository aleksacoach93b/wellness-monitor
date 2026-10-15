import { prisma } from '@/lib/prisma'
import type { PvtExportSession } from './export'

/** Fetch only submitted sessions, without raw trials, tokens or device identifiers. */
export async function loadPvtExportSessions(surveyId: string, responseIds: string[]) {
  const sessions = new Map<string, PvtExportSession>()
  // Bound the parameter count for large historical exports.
  for (let offset = 0; offset < responseIds.length; offset += 1000) {
    const rows = await prisma.pvtSession.findMany({
      where: { surveyId, responseId: { in: responseIds.slice(offset, offset + 1000) }, practice: false, status: 'COMPLETED' },
      select: {
        id: true, responseId: true, playerId: true, questionId: true, durationSeconds: true,
        protocolVersion: true, status: true, practice: true, localDate: true,
        startedAt: true, finishedAt: true, context: true, summary: true,
      },
    })
    for (const row of rows) sessions.set(row.id, row)
  }
  return sessions
}
