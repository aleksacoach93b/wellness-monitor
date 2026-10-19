import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/auth/adminSession";
import { validDay, zonedDay, shiftDay, dayWindow } from "@/lib/opsDates";
import { loadOpsQuestionMappings } from "@/lib/opsTablePrefs";
import { buildIndividualReport } from "@/lib/individualReport";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers },
    );
  const params = request.nextUrl.searchParams,
    surveyId = params.get("surveyId"),
    playerId = params.get("playerId"),
    fromParam = params.get("from"),
    toParam = params.get("to");
  if (
    !surveyId ||
    (fromParam && !validDay(fromParam)) ||
    (toParam && !validDay(toParam))
  )
    return NextResponse.json(
      { error: "Select a valid survey and date range." },
      { status: 400, headers },
    );
  try {
    const survey = await prisma.survey.findFirst({
      where: { id: surveyId, teamId: session.teamId },
      select: { id: true, title: true, timezone: true },
    });
    if (!survey)
      return NextResponse.json(
        { error: "Survey not found" },
        { status: 404, headers },
      );
    const today = zonedDay(new Date(), survey.timezone),
      to = toParam || today,
      from = fromParam || shiftDay(to, -27);
    if (
      from > to ||
      to > today ||
      (Date.parse(to) - Date.parse(from)) / 86400000 > 365
    )
      return NextResponse.json(
        { error: "Choose up to 366 days, ending today or earlier." },
        { status: 400, headers },
      );
    const select = {
      id: true,
      firstName: true,
      lastName: true,
      image: true,
      isActive: true,
    } as const;
    if (!playerId) {
      const players = await prisma.player.findMany({
        where: { teamId: session.teamId },
        select,
        orderBy: [
          { isActive: "desc" },
          { lastName: "asc" },
          { firstName: "asc" },
        ],
      });
      return NextResponse.json({ players, survey, today }, { headers });
    }
    const player = await prisma.player.findFirst({
      where: { id: playerId, teamId: session.teamId },
      select,
    });
    if (!player)
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404, headers },
      );
    const first = shiftDay(from, -28),
      start = dayWindow(first, survey.timezone).dayStart,
      end = dayWindow(to, survey.timezone).dayEnd;
    const responses = await prisma.response.findMany({
      where: {
        surveyId,
        survey: { teamId: session.teamId },
        playerId,
        player: { teamId: session.teamId },
        submittedAt: { gte: start, lt: end },
      },
      select: {
        id: true,
        playerId: true,
        submittedAt: true,
        sessionType: true,
        matchDay: true,
        answers: {
          select: {
            questionId: true,
            value: true,
            question: {
              select: {
                id: true,
                text: true,
                type: true,
                options: true,
                order: true,
              },
            },
          },
        },
      },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: 5001,
    });
    if (responses.length > 5000)
      return NextResponse.json(
        { error: "Too many submissions. Choose a shorter range." },
        { status: 400, headers },
      );
    let focusAvailable = true;
    const focus = await prisma.pvtSession
      .findMany({
        where: {
          teamId: session.teamId,
          surveyId,
          playerId,
          localDate: { gte: first, lte: to },
        },
        select: {
          id: true,
          playerId: true,
          surveyId: true,
          questionId: true,
          responseId: true,
          localDate: true,
          startedAt: true,
          durationSeconds: true,
          protocolVersion: true,
          practice: true,
          status: true,
          deviceId: true,
          userAgent: true,
          context: true,
          summary: true,
        },
        orderBy: { startedAt: "desc" },
        take: 10001,
      })
      .catch(() => {
        focusAvailable = false;
        return [];
      });
    if (focus.length > 10000)
      return NextResponse.json(
        { error: "Too many Focus attempts. Choose a shorter range." },
        { status: 400, headers },
      );
    let hrTrackingAvailable = true;
    const observations = await prisma.rhrObservation
      .findMany({
        where: {
          teamId: session.teamId,
          surveyId,
          playerId,
          localDate: { gte: from, lte: to },
        },
        select: {
          localDate: true,
          startedAt: true,
          status: true,
          bpm: true,
          position: true,
          reason: true,
        },
        orderBy: { startedAt: "desc" },
        take: 10001,
      })
      .catch(() => {
        hrTrackingAvailable = false;
        return [];
      });
    if (observations.length > 10000)
      return NextResponse.json(
        { error: "Too many HR attempts. Choose a shorter range." },
        { status: 400, headers },
      );
    const mappings = await loadOpsQuestionMappings({
      teamId: session.teamId,
      adminUserId: session.sub,
      surveyId,
    });
    return NextResponse.json(
      buildIndividualReport({
        survey,
        player,
        from,
        to,
        responses,
        focus,
        mappings: { questionMappings: mappings },
        focusAvailable,
        hrTrackingAvailable,
        hrAttempts: observations.map((o) => ({
          date: o.localDate,
          time: o.startedAt.toISOString(),
          status: o.status,
          bpm: o.bpm,
          position: o.position,
          reason: o.reason,
        })),
      }),
      { headers },
    );
  } catch (e) {
    console.error(
      "Individual report unavailable",
      e instanceof Error ? e.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "The individual report could not be loaded. Please try again." },
      { status: 503, headers },
    );
  }
}
