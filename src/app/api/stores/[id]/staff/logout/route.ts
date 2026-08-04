/**
 * POST /api/stores/[id]/staff/logout
 * Ends the active staff PIN session for this browser (see staff-session.ts) —
 * used by "switch to a different staff member" and "switch back to Owner".
 */
import { NextResponse } from "next/server";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { clearStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async () => {
    await clearStaffSession();
    return NextResponse.json(createSuccessResponse({ loggedOut: true }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff/logout", requireStoreAuth: true }
);
