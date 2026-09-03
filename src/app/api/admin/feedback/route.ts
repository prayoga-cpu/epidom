import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { feedbackService } from "@/lib/services/feedback.service";
import { updateFeedbackTriageSchema } from "@/lib/validation/feedback.schemas";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { recordAction } from "@/lib/audit/record";

/**
 * GET /api/admin/feedback
 * List recent feedback submissions with the reporting user.
 */
export const GET = withAdminApiHandler(async () => {
  const feedback = await feedbackService.getAllFeedback();

  return NextResponse.json({ feedback });
});

/**
 * PATCH /api/admin/feedback
 * Update the status and/or priority of a feedback entry.
 *
 * This is the ticket that started the audit trail (docs/AUDIT_LOG_PLAN.md) —
 * making its own triage the first thing the new log actually records is the
 * cheapest dogfooding available: before this, moving a ticket OPEN -> RESOLVED
 * left no trace of when or by whom.
 */
export const PATCH = withAdminApiHandler(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateFeedbackTriageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const before = await prisma.feedback.findUnique({
    where: { id: parsed.data.id },
    select: { status: true, priority: true, devNote: true },
  });

  if (!before) {
    return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  }

  const feedback = await feedbackService.updateFeedbackTriage(parsed.data.id, {
    status: parsed.data.status,
    priority: parsed.data.priority,
    devNote: parsed.data.devNote,
  });

  await recordAction({
    actionType: "admin.feedback.triage",
    targetId: parsed.data.id,
    payload: {
      feedbackId: parsed.data.id,
      before,
      after: {
        status: parsed.data.status,
        priority: parsed.data.priority,
        devNote: parsed.data.devNote,
      },
    },
  });

  return NextResponse.json({ feedback });
});
