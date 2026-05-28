import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * POST /api/onboarding/complete
 *
 * Marks the authenticated user's onboarding as permanently completed.
 * Called after the user publishes their store for the first time.
 * Subsequent visits to /onboarding redirect away server-side.
 */
export const POST = withApiHandler(async (_request, { userId }) => {
  await prisma.user.update({
    where: { id: userId },
    data: { hasOnboarded: true },
  });

  return NextResponse.json(createSuccessResponse({ hasOnboarded: true }));
});
