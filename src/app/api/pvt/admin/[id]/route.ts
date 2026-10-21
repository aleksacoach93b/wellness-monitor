import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/auth/adminSession";
import { focusMonitoring } from "@/lib/pvt/monitoring";
import type { PvtSessionRow } from "@/lib/pvt/baseline";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminSessionFromRequest(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const attempt = await prisma.pvtSession.findFirst({
      where: { id, teamId: admin.teamId },
      select: {
        id: true,
        playerId: true,
        surveyId: true,
        questionId: true,
        questionLabel: true,
        responseId: true,
        startedAt: true,
        finishedAt: true,
        localDate: true,
        durationSeconds: true,
        protocolVersion: true,
        practice: true,
        status: true,
        context: true,
        raw: true,
        summary: true,
        deviceId: true,
        userAgent: true,
        player: { select: { firstName: true, lastName: true } },
        survey: { select: { timezone: true } },
      },
    });
    if (!attempt)
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers },
      );
    // Raw-data download remains a small, scoped read. Monitoring history is opt-in.
    if (request.nextUrl.searchParams.get("monitoring") !== "1") {
      const { deviceId, userAgent, ...publicAttempt } = attempt;
      void deviceId;
      void userAgent;
      return NextResponse.json(publicAttempt, { headers });
    }
    const first = new Date(attempt.localDate + "T00:00:00Z");
    first.setUTCDate(first.getUTCDate() - 28);
    const history = await prisma.pvtSession.findMany({
      where: {
        teamId: admin.teamId,
        playerId: attempt.playerId,
        surveyId: attempt.surveyId,
        questionId: attempt.questionId,
        durationSeconds: attempt.durationSeconds,
        protocolVersion: attempt.protocolVersion,
        deviceId: attempt.deviceId,
        userAgent: attempt.userAgent,
        practice: false,
        status: "COMPLETED",
        localDate: {
          gte: first.toISOString().slice(0, 10),
          lt: attempt.localDate,
        },
      },
      select: {
        id: true,
        playerId: true,
        surveyId: true,
        questionId: true,
        startedAt: true,
        finishedAt: true,
        localDate: true,
        durationSeconds: true,
        protocolVersion: true,
        practice: true,
        status: true,
        deviceId: true,
        userAgent: true,
        context: true,
        raw: true,
        summary: true,
      },
      orderBy: [{ startedAt: "asc" }, { id: "asc" }],
      take: 2001,
    });
    type MonitoringSession = PvtSessionRow & { raw?: unknown };
    const current = JSON.parse(JSON.stringify(attempt)) as MonitoringSession;
    const prior = JSON.parse(JSON.stringify(history)) as MonitoringSession[];
    const { deviceId, userAgent, ...publicAttempt } = attempt;
    void deviceId;
    void userAgent;
    // context includes a client device ID for historical reasons; never expose it here.
    const context = current.context;
    const monitoring = focusMonitoring(current, prior, history.length > 2000);
    return NextResponse.json(
      {
        ...publicAttempt,
        raw: monitoring.analysis ? attempt.raw : null,
        context: {
          posture: context.posture,
          caffeine: context.caffeine,
          minutesAwake: context.minutesAwake,
        },
        monitoring,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Focus session unavailable. Please try again." },
      { status: 503, headers },
    );
  }
}
