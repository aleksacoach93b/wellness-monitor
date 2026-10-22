import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import { readOpsIndividual } from '@/lib/opsReaders/individual'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return readOpsIndividual(request, session)
}
