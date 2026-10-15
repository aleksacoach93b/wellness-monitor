import { SignJWT, jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
export const PVT_PLAYER_COOKIE = 'wm_pvt_player'
function key() {
  const value = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
  return value ? new TextEncoder().encode(value) : null
}
export async function playerGrant(playerId: string, surveyId: string) {
  const secret = key()
  return secret ? new SignJWT({ surveyId }).setProtectedHeader({ alg: 'HS256' }).setSubject(playerId).setAudience('pvt-player').setIssuedAt().setExpirationTime('2h').sign(secret) : null
}
export async function hasPlayerGrant(request: NextRequest, playerId: string, surveyId: string) {
  const token = request.cookies.get(PVT_PLAYER_COOKIE)?.value, secret = key()
  if (!token || !secret) return false
  try { const { payload } = await jwtVerify(token, secret, { audience: 'pvt-player', algorithms: ['HS256'] }); return payload.sub === playerId && payload.surveyId === surveyId } catch { return false }
}
