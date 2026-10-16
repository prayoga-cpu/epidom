import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getActiveStaffSession } from "@/lib/staff-session";
import { getStoreViewer } from "@/lib/auth/store-viewer";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { requireStoreFeatureApi } from "@/lib/auth/require-store-feature";
import { ApiErrorCode, createErrorResponse } from "@/types/api/responses";

export interface OvertimeDecider {
  userId: string | null;
  /**
   * The staff member deciding, when it's a staff member — a MANAGER persona,
   * or a linked staff account. Null for the owner. Nobody decides their own
   * overtime: a manager's goes to the owner.
   */
  staffMemberId: string | null;
  name: string;
}

/** Who is approving overtime on this store right now. Call after guardOvertimeDecisionApi. */
export async function resolveOvertimeDecider(storeId: string): Promise<OvertimeDecider> {
  const [session, viewer, staffSession] = await Promise.all([
    getSession(),
    getStoreViewer(storeId),
    getActiveStaffSession(),
  ]);
  const persona = staffSession && staffSession.storeId === storeId ? staffSession : null;
  const staffMemberId =
    viewer.kind === "staff"
      ? viewer.staffMemberId
      : persona && persona.role !== "OWNER"
        ? persona.staffMemberId
        : null;
  return {
    userId: session?.user?.id ?? null,
    staffMemberId,
    name: persona?.name ?? session?.user?.name ?? "Owner",
  };
}

/**
 * Approving overtime decides what someone is paid, so on top of the manager
 * gate it refuses a persona signed in on ANOTHER of the owner's stores —
 * requireManagerOrOwnerApi alone would read that as the owner (the same
 * explicit check as DELETE cash-movements).
 *
 * @returns an error NextResponse to return immediately, or null to proceed.
 */
export async function guardOvertimeDecisionApi(storeId: string): Promise<NextResponse | null> {
  const staffSession = await getActiveStaffSession();
  if (staffSession && staffSession.storeId !== storeId) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.FORBIDDEN, "Switch to this store first"),
      {
        status: 403,
      }
    );
  }
  const guardResponse = await requireManagerOrOwnerApi(storeId);
  if (guardResponse) return guardResponse;
  return requireStoreFeatureApi(storeId, "staffOperations", "Staff schedules");
}
