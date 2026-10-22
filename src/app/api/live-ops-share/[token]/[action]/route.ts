import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { readOpsToday } from "@/lib/opsReaders/today";
import { readOpsCalendar } from "@/lib/opsReaders/calendar";
import { readOpsInsights } from "@/lib/opsReaders/insights";
import { readOpsIndividual } from "@/lib/opsReaders/individual";
import {
  loadOpsTableColumns,
  loadSurveyQuestionsForOps,
} from "@/lib/opsTablePrefs";
import {
  auditShare,
  consumeShareLimit,
  releaseShareLimit,
  finishShareRead,
  isBlocked,
  liveLink,
  requireShare,
  ShareDenied,
} from "@/lib/opsShare/service";
import {
  cookieOptions,
  newShareToken,
  SHARE_COOKIE,
  SHARE_TOKEN,
  shareHash,
  shareHeaders,
  shareSameOrigin,
  viewerMeta,
  shareJson,
} from "@/lib/opsShare/security";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: shareHeaders });
type Context = { params: Promise<{ token: string; action: string }> };
const readers = {
  today: readOpsToday,
  calendar: readOpsCalendar,
  insights: readOpsInsights,
  individual: readOpsIndividual,
};
function denied(error: unknown) {
  if (error instanceof ShareDenied)
    return json({ error: error.message }, error.status);
  console.error(
    "Shared Live Ops unavailable",
    error instanceof Error ? error.name : "Unknown",
  );
  return json(
    { error: "Staff access is temporarily unavailable. Please try again." },
    503,
  );
}
export async function POST(request: NextRequest, context: Context) {
  if (!shareSameOrigin(request))
    return json({ error: "Invalid request origin" }, 403);
  const { token, action } = await context.params;
  if (!SHARE_TOKEN.test(token) || !["login", "logout"].includes(action))
    return json({ error: "Access unavailable" }, 404);
  try {
    if (action === "logout") {
      try {
        const access = await requireShare(request, token);
        await prisma.$transaction([
          prisma.opsShareSession.update({
            where: { id: access.session.id },
            data: { revokedAt: new Date() },
          }),
          prisma.opsShareEvent.create({
            data: {
              teamId: access.link.teamId,
              linkId: access.link.id,
              sessionId: access.session.id,
              label: access.link.label,
              kind: "LOGOUT",
              resource: "logout",
              ...access.meta,
            },
          }),
        ]);
      } catch (e) {
        if (!(e instanceof ShareDenied)) throw e;
      }
      const response = json({ ok: true });
      response.cookies.set(SHARE_COOKIE, "", cookieOptions(token, 0));
      return response;
    }
    const meta = viewerMeta(request);
    if (!(await consumeShareLimit("login-ip:" + meta.ip, 120, 900)))
      return json(
        { error: "Too many attempts. Try again in 15 minutes." },
        429,
      );
    const payload = await shareJson(request, 2048);
    if (payload.oversized) return json({ error: "Request too large" }, 413);
    const body = z
      .object({
        password: z
          .string()
          .min(1)
          .max(72)
          .refine((s) => Buffer.byteLength(s, "utf8") <= 72),
        tablet: z.boolean().optional(),
      })
      .safeParse(payload.value);
    if (!body.success) return json({ error: "Enter the staff password." }, 400);
    const link = await liveLink(token);
    if (
      !(await consumeShareLimit(
        `login-team-ip:${link.teamId}:${meta.ip}`,
        10,
        900,
      )) ||
      !(await consumeShareLimit("login-link:" + link.id, 100, 900))
    )
      return json(
        { error: "Too many attempts. Try again in 15 minutes." },
        429,
      );
    const allowed =
      !(await isBlocked(link.teamId, meta.ip)) &&
      (await verifyPassword(body.data.password, link.settings.passwordHash));
    if (!allowed) {
      await auditShare(
        {
          teamId: link.teamId,
          linkId: link.id,
          label: link.label,
          kind: "LOGIN_FAILED",
          resource: "login",
        },
        meta,
      );
      return json(
        { error: "Access denied. Check your password or contact your coach." },
        401,
      );
    }
    const raw = newShareToken(),
      expiresAt = new Date(
        Math.min(
          Date.now() + link.settings.sessionHours * 3600000,
          link.expiresAt.getTime(),
        ),
      );
    const detail = viewerMeta(request, body.data.tablet);
    const session = await prisma.opsShareSession.create({
      data: {
        linkId: link.id,
        tokenHash: shareHash(raw),
        version: link.settings.version,
        expiresAt,
        ...detail,
      },
    });
    // If settings changed during password hashing, no stale session may be issued.
    const fresh = await liveLink(token);
    if (
      fresh.settings.version !== session.version ||
      (await isBlocked(link.teamId, meta.ip))
    ) {
      await prisma.opsShareSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new ShareDenied();
    }
    await auditShare(
      {
        teamId: link.teamId,
        linkId: link.id,
        sessionId: session.id,
        label: link.label,
        kind: "LOGIN_SUCCESS",
        resource: "login",
      },
      detail,
    );
    await releaseShareLimit(`login-team-ip:${link.teamId}:${meta.ip}`);
    const response = json({
      ok: true,
      label: link.label,
      expiresAt,
      sessionTag: session.id.slice(-8),
      ip: meta.ip,
    });
    response.cookies.set(
      SHARE_COOKIE,
      raw,
      cookieOptions(
        token,
        Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
      ),
    );
    return response;
  } catch (e) {
    return denied(e);
  }
}
export async function GET(request: NextRequest, context: Context) {
  const { token, action } = await context.params;
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return json({ error: "Access denied" }, 403);
  if (
    !Object.hasOwn(readers, action) &&
    action !== "table-preferences" &&
    action !== "status"
  )
    return json({ error: "Access unavailable" }, 404);
  if (request.url.length > 2400)
    return json({ error: "Request too large" }, 414);
  try {
    const access = await requireShare(request, token);
    if (!(await consumeShareLimit("read:" + access.session.id, 240, 60)))
      return json({ error: "Too many requests. Wait a minute." }, 429);
    if (action === "status") {
      await prisma.opsShareSession.update({
        where: { id: access.session.id },
        data: { lastSeenAt: new Date(), ip: access.meta.ip },
      });
      return json({
        ok: true,
        label: access.link.label,
        expiresAt: access.session.expiresAt,
        sessionTag: access.session.id.slice(-8),
        ip: access.meta.ip,
      });
    }
    let response: NextResponse;
    if (action === "table-preferences") {
      const surveyId = request.nextUrl.searchParams.get("surveyId");
      if (
        !surveyId ||
        !(await prisma.survey.findFirst({
          where: { id: surveyId, teamId: access.link.teamId },
          select: { id: true },
        }))
      )
        return json({ error: "Survey not found" }, 404);
      const args = {
        teamId: access.link.teamId,
        adminUserId: access.reader.sub,
        surveyId,
      };
      const [columns, questions] = await Promise.all([
        loadOpsTableColumns(args),
        loadSurveyQuestionsForOps(args),
      ]);
      response = json({ columns, questions, surveyId });
    } else {
      response = await readers[action as keyof typeof readers](
        request,
        access.reader,
      );
    }
    await finishShareRead(request, token, action, response.status);
    // Enforce privacy headers for success and reader validation/error responses alike.
    for (const [key, value] of Object.entries(shareHeaders))
      response.headers.set(key, value);
    return response;
  } catch (e) {
    return denied(e);
  }
}
