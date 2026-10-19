import { NextResponse } from "next/server";

import { feedbackService } from "@/lib/services/feedback.service";
import { customDevelopmentService } from "@/lib/services/custom-development.service";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { canOpenSection } from "@/config/admin-sections.config";

/**
 * GET /api/admin/pending-counts
 * Counts of open feedback and new custom development requests, for the
 * admin panel's nav badges. An account given some admin pages only gets the
 * counts of the pages it may open (the others are null).
 */
export async function GET() {
  const access = await getAdminAccess();
  if (!access?.grantSource) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [feedback, customDevelopment] = await Promise.all([
    canOpenSection(access, "feedback") ? feedbackService.getOpenFeedbackCount() : null,
    canOpenSection(access, "custom-development")
      ? customDevelopmentService.getNewRequestCount()
      : null,
  ]);

  return NextResponse.json({ feedback, customDevelopment });
}
