import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import { feedbackService } from "@/lib/services/feedback.service";
import { updateFeedbackTriageSchema } from "@/lib/validation/feedback.schemas";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, isAdmin: true },
  });
  if (!user || !isAdminUser(user.email, user.isAdmin)) return null;
  return user;
}

/**
 * GET /api/admin/feedback
 * List recent feedback submissions with the reporting user.
 */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const feedback = await feedbackService.getAllFeedback();

  return NextResponse.json({ feedback });
}

/**
 * PATCH /api/admin/feedback
 * Update the status and/or priority of a feedback entry.
 */
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const feedback = await feedbackService.updateFeedbackTriage(parsed.data.id, {
    status: parsed.data.status,
    priority: parsed.data.priority,
  });

  return NextResponse.json({ feedback });
}
