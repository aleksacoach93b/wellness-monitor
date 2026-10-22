import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SHARE_COOKIE,
  SHARE_TOKEN,
  shareHash,
  viewerMeta,
  safeResource,
} from "./security";

export class ShareDenied extends Error {
  constructor(
    public status = 401,
    message = "Access ended. Enter the password again or contact your coach.",
  ) {
    super(message);
  }
}
export async function consumeShareLimit(
  key: string,
  limit: number,
  seconds: number,
) {
  // Atomic fixed-window counter shared by all server instances. No in-memory bypass.
  const rows = await prisma.$queryRaw<{ attempts: number }[]>`
    INSERT INTO "ops_share_auth_windows" ("key", "attempts", "expiresAt")
    VALUES (${shareHash(key)}, 1, CURRENT_TIMESTAMP + ${seconds} * INTERVAL '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "ops_share_auth_windows"."expiresAt" <= CURRENT_TIMESTAMP THEN 1 ELSE LEAST("ops_share_auth_windows"."attempts" + 1, 1000000) END,
      "expiresAt" = CASE WHEN "ops_share_auth_windows"."expiresAt" <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + ${seconds} * INTERVAL '1 second' ELSE "ops_share_auth_windows"."expiresAt" END
    RETURNING "attempts"`;
  return rows[0].attempts <= limit;
}
export async function isBlocked(teamId: string, ip: string) {
  return (
    ip !== "Unavailable" &&
    !!(await prisma.opsShareBlockedIp.findUnique({
      where: { teamId_ip: { teamId, ip } },
    }))
  );
}
export async function liveLink(token: string) {
  if (!SHARE_TOKEN.test(token)) throw new ShareDenied();
  const link = await prisma.opsShareLink.findUnique({
    where: { token },
    include: { settings: true },
  });
  if (
    !link ||
    !link.enabled ||
    link.expiresAt <= new Date() ||
    !link.settings.enabled ||
    !link.settings.passwordHash
  )
    throw new ShareDenied();
  // Revoked admin membership/disabled account also removes the source of permission.
  const owner = await prisma.adminUser.findFirst({
    where: {
      id: link.settings.ownerAdminId,
      isActive: true,
      memberships: { some: { teamId: link.teamId } },
    },
    select: { id: true },
  });
  if (!owner) throw new ShareDenied();
  return link;
}
export async function requireShare(request: NextRequest, token: string) {
  const raw = request.cookies.get(SHARE_COOKIE)?.value;
  if (!raw || !SHARE_TOKEN.test(raw)) throw new ShareDenied();
  const link = await liveLink(token);
  const session = await prisma.opsShareSession.findUnique({
    where: { tokenHash: shareHash(raw) },
  });
  const meta = viewerMeta(request);
  if (
    !session ||
    session.linkId !== link.id ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.version !== link.settings.version ||
    session.userAgent !== meta.userAgent ||
    (await isBlocked(link.teamId, meta.ip))
  )
    throw new ShareDenied();
  return {
    link,
    session,
    meta: {
      ...meta,
      platform: session.platform,
      device: session.device,
      browser: session.browser,
    },
    reader: {
      teamId: link.teamId,
      sub: link.settings.ownerAdminId,
      readOnly: true,
    },
  };
}
export async function auditShare(
  args: {
    teamId: string;
    linkId?: string;
    sessionId?: string;
    label: string;
    kind: string;
    resource: string;
  },
  meta: ReturnType<typeof viewerMeta>,
) {
  await prisma.opsShareEvent.create({ data: { ...args, ...meta } });
}
export async function finishShareRead(
  request: NextRequest,
  token: string,
  action: string,
  status = 200,
) {
  // Re-check after the data query, so a password change during a slow query denies release.
  const access = await requireShare(request, token);
  await prisma.$transaction([
    prisma.opsShareSession.update({
      where: { id: access.session.id },
      data: { lastSeenAt: new Date(), ip: access.meta.ip },
    }),
    prisma.opsShareEvent.create({
      data: {
        teamId: access.link.teamId,
        linkId: access.link.id,
        sessionId: access.session.id,
        label: access.link.label,
        kind: status < 400 ? "VIEW" : "VIEW_FAILED",
        resource: safeResource(request, action),
        ...access.meta,
      },
    }),
  ]);
  return access;
}
