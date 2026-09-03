import { NextResponse } from "next/server";

import { feedbackService } from "@/lib/services/feedback.service";
import { customDevelopmentService } from "@/lib/services/custom-development.service";
import { getActingAdmin } from "@/lib/auth/require-admin-api";

/**
 * GET /api/admin/pending-counts
 * Counts of open feedback and new custom development requests, for the
 * admin panel's nav badges.
 */
export async function GET() {
  if (!(await getActingAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [feedback, customDevelopment] = await Promise.all([
    feedbackService.getOpenFeedbackCount(),
    customDevelopmentService.getNewRequestCount(),
  ]);

  return NextResponse.json({ feedback, customDevelopment });
}
