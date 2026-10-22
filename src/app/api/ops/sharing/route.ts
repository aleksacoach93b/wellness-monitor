import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/auth/adminSession";
import { hashPassword } from "@/lib/auth/password";
import { ensureOpsShareSchema } from "@/lib/opsShare/schema";
import {
  newShareToken,
  shareHeaders,
  shareSameOrigin,
  viewerMeta,
  shareJson,
} from "@/lib/opsShare/security";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: shareHeaders });
const commands = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("settings"),
    enabled: z.boolean(),
    sessionHours: z.number().int().min(1).max(12),
    password: z
      .string()
      .min(10)
      .max(72)
      .refine((s) => Buffer.byteLength(s, "utf8") <= 72)
      .optional(),
  }),
  z.object({
    action: z.literal("create-link"),
    label: z.string().trim().min(1).max(80),
    days: z.number().int().min(1).max(90),
  }),
  z.object({
    action: z.literal("revoke-link"),
    id: z.string().min(1).max(100),
  }),
  z.object({
    action: z.literal("rotate-link"),
    id: z.string().min(1).max(100),
  }),
  z.object({
    action: z.literal("revoke-session"),
    id: z.string().min(1).max(100),
  }),
  z.object({ action: z.literal("disconnect-all") }),
  z.object({
    action: z.enum(["block-ip", "unblock-ip"]),
    ip: z.string().min(2).max(50),
  }),
]);
async function admin(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) return null;
  return (await prisma.adminUser.findFirst({
    where: {
      id: session.sub,
      isActive: true,
      memberships: { some: { teamId: session.teamId } },
    },
    select: { id: true },
  }))
    ? session
    : null;
}
export async function GET(request: NextRequest) {
  try {
    const session = await admin(request);
    if (!session) return json({ error: "Unauthorized" }, 401);
    await ensureOpsShareSchema();
    const teamId = session.teamId;
    const cursor = request.nextUrl.searchParams.get("cursor");
    if (
      cursor &&
      !(await prisma.opsShareEvent.findFirst({
        where: { id: cursor, teamId },
        select: { id: true },
      }))
    )
      return json({ error: "Invalid journal cursor" }, 400);
    const [settings, links, sessions, events, blockedIps] = await Promise.all([
      prisma.opsShareSettings.findUnique({
        where: { teamId },
        select: {
          enabled: true,
          passwordHash: true,
          sessionHours: true,
          updatedAt: true,
        },
      }),
      prisma.opsShareLink.findMany({
        where: { teamId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.opsShareSession.findMany({
        where: { link: { teamId } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          ip: true,
          platform: true,
          device: true,
          browser: true,
          userAgent: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
          revokedAt: true,
          version: true,
          link: {
            select: {
              label: true,
              enabled: true,
              expiresAt: true,
              settings: { select: { version: true, enabled: true } },
            },
          },
        },
      }),
      prisma.opsShareEvent.findMany({
        where: { teamId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.opsShareBlockedIp.findMany({
        where: { teamId },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return json({
      settings: {
        enabled: settings?.enabled ?? false,
        hasPassword: !!settings?.passwordHash,
        sessionHours: settings?.sessionHours ?? 4,
        updatedAt: settings?.updatedAt ?? null,
      },
      links,
      sessions: sessions.map(({ version, link, ...s }) => ({
        ...s,
        label: link.label,
        active:
          !s.revokedAt &&
          s.expiresAt > new Date() &&
          link.enabled &&
          link.expiresAt > new Date() &&
          link.settings.enabled &&
          link.settings.version === version &&
          !blockedIps.some((b) => b.ip === s.ip),
      })),
      events: events.slice(0, 50),
      nextCursor: events.length > 50 ? events[49].id : null,
      blockedIps,
    });
  } catch (error) {
    console.error(
      "Sharing settings unavailable",
      error instanceof Error ? error.name : "Unknown",
    );
    return json(
      { error: "Sharing settings could not be loaded. Please try again." },
      503,
    );
  }
}
export async function POST(request: NextRequest) {
  if (!shareSameOrigin(request))
    return json({ error: "Invalid request origin" }, 403);
  try {
    const session = await admin(request);
    if (!session) return json({ error: "Unauthorized" }, 401);
    const payload = await shareJson(request, 4096);
    if (payload.oversized) return json({ error: "Request too large" }, 413);
    const parsed = commands.safeParse(payload.value);
    if (!parsed.success)
      return json(
        { error: "Check the fields. Passwords need 10–72 UTF-8 bytes." },
        400,
      );
    await ensureOpsShareSchema();
    const c = parsed.data,
      teamId = session.teamId,
      meta = viewerMeta(request);
    const event = (
      kind: string,
      label = "Staff access",
      linkId?: string,
      sessionId?: string,
    ) => ({
      teamId,
      kind,
      label,
      resource: "settings",
      linkId,
      sessionId,
      ...meta,
    });
    if (c.action === "settings") {
      const existing = await prisma.opsShareSettings.findUnique({
        where: { teamId },
      });
      if (c.enabled && !c.password && !existing?.passwordHash)
        return json(
          { error: "Set a password before enabling staff access." },
          400,
        );
      const passwordHash = c.password
        ? await hashPassword(c.password)
        : existing?.passwordHash || "";
      await prisma.$transaction([
        prisma.opsShareSettings.upsert({
          where: { teamId },
          create: {
            teamId,
            ownerAdminId: session.sub,
            enabled: c.enabled,
            passwordHash,
            sessionHours: c.sessionHours,
          },
          update: {
            ownerAdminId: session.sub,
            enabled: c.enabled,
            passwordHash,
            sessionHours: c.sessionHours,
            version: { increment: 1 },
          },
        }),
        prisma.opsShareEvent.create({
          data: event(
            c.password
              ? "PASSWORD_CHANGED"
              : c.enabled
                ? "SETTINGS_CHANGED"
                : "SHARING_DISABLED",
          ),
        }),
      ]);
    } else {
      const settings = await prisma.opsShareSettings.findUnique({
        where: { teamId },
      });
      if (!settings)
        return json({ error: "Save staff access settings first." }, 400);
      if (c.action === "create-link") {
        if (!settings.passwordHash || !settings.enabled)
          return json(
            { error: "Enable staff access and set a password first." },
            400,
          );
        if ((await prisma.opsShareLink.count({ where: { teamId } })) >= 100)
          return json({ error: "The limit is 100 staff links." }, 400);
        const id = newShareToken();
        await prisma.$transaction([
          prisma.opsShareLink.create({
            data: {
              id,
              teamId,
              token: newShareToken(),
              label: c.label,
              expiresAt: new Date(Date.now() + c.days * 86400000),
            },
          }),
          prisma.opsShareEvent.create({
            data: event("LINK_CREATED", c.label, id),
          }),
        ]);
      } else if (c.action === "revoke-link" || c.action === "rotate-link") {
        const link = await prisma.opsShareLink.findFirst({
          where: { id: c.id, teamId },
        });
        if (!link) return json({ error: "Link not found" }, 404);
        if (
          c.action === "rotate-link" &&
          (!link.enabled || link.expiresAt <= new Date())
        )
          return json(
            { error: "Create a new link for revoked or expired access." },
            400,
          );
        await prisma.$transaction([
          prisma.opsShareLink.update({
            where: { id: link.id },
            data:
              c.action === "rotate-link"
                ? { token: newShareToken() }
                : { enabled: false },
          }),
          prisma.opsShareSession.updateMany({
            where: { linkId: link.id, revokedAt: null },
            data: { revokedAt: new Date() },
          }),
          prisma.opsShareEvent.create({
            data: event(
              c.action === "rotate-link" ? "LINK_ROTATED" : "LINK_REVOKED",
              link.label,
              link.id,
            ),
          }),
        ]);
      } else if (c.action === "revoke-session") {
        const s = await prisma.opsShareSession.findFirst({
          where: { id: c.id, link: { teamId } },
          include: { link: true },
        });
        if (!s) return json({ error: "Session not found" }, 404);
        await prisma.$transaction([
          prisma.opsShareSession.update({
            where: { id: s.id },
            data: { revokedAt: new Date() },
          }),
          prisma.opsShareEvent.create({
            data: event("SESSION_REVOKED", s.link.label, s.linkId, s.id),
          }),
        ]);
      } else if (c.action === "disconnect-all") {
        await prisma.$transaction([
          prisma.opsShareSettings.update({
            where: { teamId },
            data: { version: { increment: 1 } },
          }),
          prisma.opsShareEvent.create({ data: event("ALL_SESSIONS_REVOKED") }),
        ]);
      } else if (c.action === "block-ip" || c.action === "unblock-ip") {
        const { isIP } = await import("node:net");
        if (!isIP(c.ip))
          return json(
            { error: "A valid IPv4 or IPv6 address is required." },
            400,
          );
        const ip = c.ip.toLowerCase();
        const changes: Prisma.PrismaPromise<unknown>[] = [
          ...(c.action === "block-ip"
            ? [
                prisma.opsShareBlockedIp.upsert({
                  where: { teamId_ip: { teamId, ip } },
                  create: { teamId, ip },
                  update: {},
                }),
              ]
            : [prisma.opsShareBlockedIp.deleteMany({ where: { teamId, ip } })]),
          prisma.opsShareEvent.create({
            data: event(
              c.action === "block-ip" ? "IP_BLOCKED" : "IP_UNBLOCKED",
              ip,
            ),
          }),
        ];
        await prisma.$transaction(changes);
      }
    }
    // Fixed retention, scoped to this club. Credentials are never journaled.
    const cutoff = new Date(Date.now() - 90 * 86400000);
    await prisma.opsShareEvent.deleteMany({
      where: { teamId, createdAt: { lt: cutoff } },
    });
    await prisma.opsShareSession.deleteMany({
      where: { link: { teamId }, expiresAt: { lt: cutoff } },
    });
    await prisma.opsShareAuthWindow.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 86400000) } },
    });
    return json({ ok: true });
  } catch (error) {
    console.error(
      "Sharing update unavailable",
      error instanceof Error ? error.name : "Unknown",
    );
    return json(
      { error: "The change could not be confirmed. Refresh and try again." },
      503,
    );
  }
}
