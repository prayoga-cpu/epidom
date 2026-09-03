import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse } from "@/types/api/responses";

/**
 * GET /api/user/activity
 *
 * The account holder's own history, for the profile page. Two sections:
 *
 *   mine     — what this user did
 *   account  — what was done TO their account by someone else
 *
 * The second section deliberately never names the acting admin. The user needs
 * to know a change happened and be able to challenge it; naming an individual
 * support agent invites retaliation and gives the user nothing they can act on.
 */
export const GET = withApiHandler(
  async (request, { userId }) => {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

    const [mine, account] = await Promise.all([
      prisma.activityEvent.findMany({
        where: { actorKind: "USER", actorRefId: userId },
        orderBy: { occurredAt: "desc" },
        take: limit,
        select: {
          id: true,
          occurredAt: true,
          actionCode: true,
          route: true,
          method: true,
          outcome: true,
          severity: true,
          storeId: true,
          targetType: true,
        },
      }),
      // Actions performed BY somebody else that name this user as a subject.
      prisma.actionLog.findMany({
        where: {
          subjectUserIds: { has: userId },
          NOT: { actorRefId: userId },
          state: { in: ["RECORDED", "REVERTED"] },
        },
        orderBy: { occurredAt: "desc" },
        take: limit,
        select: {
          id: true,
          occurredAt: true,
          actionType: true,
          category: true,
          state: true,
          targetLabel: true,
          flaggedAt: true,
        },
      }),
    ]);

    return NextResponse.json(
      createSuccessResponse({
        mine: mine.map((r) => ({ ...r, occurredAt: r.occurredAt.toISOString() })),
        account: account.map((r) => ({
          id: r.id,
          occurredAt: r.occurredAt.toISOString(),
          actionType: r.actionType,
          category: r.category,
          state: r.state,
          label: r.targetLabel,
          flagged: Boolean(r.flaggedAt),
          // Always "Support", never the individual admin.
          by: "Support",
        })),
      })
    );
  },
  { rateLimitEndpoint: "/api/user/activity" }
);

/**
 * POST /api/user/activity
 *
 * "This wasn't me" — the user flags an action taken on their account.
 *
 * Reuses the existing feedback pipeline rather than building a second
 * escalation channel: the flag sets `flaggedAt` (surfacing on the admin Flagged
 * card) and the client opens the normal feedback dialog pre-filled with the
 * event reference, which already routes to the team by email via Inngest.
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json().catch(() => null);
    const actionLogId = typeof body?.actionLogId === "string" ? body.actionLogId : null;
    const note = typeof body?.note === "string" ? body.note.slice(0, 1000) : null;

    if (!actionLogId) {
      return NextResponse.json({ error: "actionLogId is required" }, { status: 400 });
    }

    // Scoped to rows that actually name this user as a subject, so one user
    // cannot flag another's history.
    const target = await prisma.actionLog.findFirst({
      where: { id: actionLogId, subjectUserIds: { has: userId } },
      select: { id: true },
    });

    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.actionLog.update({
      where: { id: target.id },
      data: {
        flaggedAt: new Date(),
        flaggedNote: note ?? "Flagged by the account holder as unexpected.",
      },
      select: { id: true, flaggedAt: true },
    });

    return NextResponse.json(createSuccessResponse({ flagged: true, actionLog: updated }));
  },
  { rateLimitEndpoint: "/api/user/activity" }
);
