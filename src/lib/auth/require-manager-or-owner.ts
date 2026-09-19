import { NextResponse } from "next/server";
import { getActiveStaffSession } from "@/lib/staff-session";
import { getStoreViewer } from "./store-viewer";
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
  const viewer = await getStoreViewer(storeId);
  const staffSession = await getActiveStaffSession();

  // A linked staff account is never "the real owner", so the absence of a PIN
  // persona must not read as owner here: it needs a live persona that is its
  // OWN member, and then the same MANAGER/OWNER role test as everyone else.
  if (viewer.kind === "staff") {
    if (
      !staffSession ||
      staffSession.storeId !== storeId ||
      staffSession.staffMemberId !== viewer.staffMemberId ||
      (staffSession.role !== "OWNER" && staffSession.role !== "MANAGER")
    ) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.FORBIDDEN, "Only an owner or manager can do this"),
        { status: 403 }
      );
    }
    return null;
  }
  if (viewer.kind === "none") {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.FORBIDDEN, "Only an owner or manager can do this"),
      { status: 403 }
    );
  }

  if (!staffSession || staffSession.storeId !== storeId) return null;

  if (staffSession.role !== "OWNER" && staffSession.role !== "MANAGER") {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.FORBIDDEN, "Only an owner or manager can do this"),
      { status: 403 }
    );
  }

  return null;
}
