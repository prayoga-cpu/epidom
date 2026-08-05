import { NextResponse } from "next/server";
import { getActiveStaffSession } from "@/lib/staff-session";
import { ApiErrorCode, createErrorResponse } from "@/types/api/responses";

/**
 * API-route gate for mutating endpoints that only the real owner or a
 * MANAGER-role staff persona should reach (roster publishing, attendance
 * corrections, the overtime threshold setting). No active staff session at
 * all means the real owner is calling — always allowed. Mirrors the inline
 * check in pos/kds/settings/route.ts, generalized so new routes don't
 * copy-paste it.
 *
 * @returns an error NextResponse to return immediately, or null to proceed.
 */
export async function requireManagerOrOwnerApi(storeId: string): Promise<NextResponse | null> {
  const staffSession = await getActiveStaffSession();
  if (!staffSession || staffSession.storeId !== storeId) return null;

  if (staffSession.role !== "OWNER" && staffSession.role !== "MANAGER") {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.FORBIDDEN, "Only an owner or manager can do this"),
      { status: 403 }
    );
  }

  return null;
}
