import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { verifyStoreAccess, type StoreAccess } from "@/lib/utils/store-verification";
import { authorizeStaffPrincipal } from "@/lib/auth/staff-principal-policy";
import { getActiveStaffSession } from "@/lib/staff-session";
import { getSetupProgress } from "@/lib/services/setup-progress.service";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

const MANAGER_ROLES = new Set(["OWNER", "MANAGER"]);

function forbidden(message = "Only the owner or a manager of this store can see its setup") {
  return NextResponse.json(createErrorResponse(ApiErrorCode.FORBIDDEN, message), {
    status: 403,
    headers: NO_STORE,
  });
}

/**
 * GET /api/stores/[id]/setup-progress
 *
 * The store's Getting-started checklist (SetupProgress). Read-only, no input
 * beyond the path.
 *
 * Who may read it — checked here rather than through `requireStoreAuth`, whose
 * error mapping answers a store of another business with a 404:
 *  - The store must belong to the caller's business, or the caller's account
 *    must be linked to it as active staff (verifyStoreAccess). Anything else,
 *    including an unknown id, is a 403.
 *  - A linked staff account is then held to the default-deny staff policy
 *    (authorizeStaffPrincipal). This route is not listed there, so linked
 *    accounts — POS-only by design, and the checklist lives in Back Office —
 *    are refused until a line is added; if one is, the persona check below
 *    still requires a MANAGER/OWNER PIN persona of that same member.
 *  - On the owner's account, a PIN persona for THIS store must be OWNER or
 *    MANAGER: a cashier or kitchen persona on the owner's device is refused.
 *    Same rule as the dashboard page (isRestrictedStaff), whose checklist this
 *    feeds; a persona left over from another store doesn't restrict this one.
 *  - A persona that is held to page grants (any linked-account persona; a
 *    non-OWNER persona on the owner's device) must hold "/dashboard", as the
 *    dashboard page's requireStaffPageAccess demands, and only sees the items
 *    whose pages it can open (getSetupProgress's `personaPages`): no "Add
 *    staff" row (owner-only page) for a Manager, no stock rows for a Manager
 *    without "/data".
 */
export const GET = withApiHandler(
  async (request, { params, userId }) => {
    const storeId = typeof params?.id === "string" ? params.id : "";
    if (!storeId) return forbidden();

    let access: StoreAccess;
    try {
      access = await verifyStoreAccess(storeId, userId);
    } catch {
      return forbidden();
    }

    const persona = await getActiveStaffSession();
    // The page grants that bound what this viewer can open; null is the owner.
    let personaPages: string[] | null = null;

    if (access.accessType === "staff") {
      const denied = await authorizeStaffPrincipal({
        storeId,
        staffMemberId: access.staffMemberId,
        request,
      });
      if (denied) return denied;

      const isOwnManagerPersona =
        !!persona &&
        persona.storeId === storeId &&
        persona.staffMemberId === access.staffMemberId &&
        MANAGER_ROLES.has(persona.role);
      if (!isOwnManagerPersona) return forbidden();
      // A linked account never takes the OWNER-role shortcut (requireStaffPageAccess).
      personaPages = persona.allowedPages;
    } else if (persona && persona.storeId === storeId && persona.role !== "OWNER") {
      if (!MANAGER_ROLES.has(persona.role)) return forbidden();
      personaPages = persona.allowedPages;
    }

    if (personaPages && !personaPages.includes("/dashboard")) return forbidden();

    const progress = await getSetupProgress(storeId, new Date(), personaPages);
    return NextResponse.json(createSuccessResponse(progress), { headers: NO_STORE });
  },
  { rateLimitEndpoint: "/api/stores/[id]/setup-progress", requireStoreAuth: false }
);
