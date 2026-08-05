import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import { feedbackService } from "@/lib/services/feedback.service";
import { customDevelopmentService } from "@/lib/services/custom-development.service";

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
 * GET /api/admin/pending-counts
 * Counts of open feedback and new custom development requests, for the
 * admin panel's nav badges.
 */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [feedback, customDevelopment] = await Promise.all([
    feedbackService.getOpenFeedbackCount(),
    customDevelopmentService.getNewRequestCount(),
  ]);

  return NextResponse.json({ feedback, customDevelopment });
}
