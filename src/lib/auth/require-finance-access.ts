import { NextResponse } from "next/server";
import { getActiveStaffSession, type ActiveStaffSession } from "@/lib/staff-session";
import { requireStoreFeatureApi } from "./require-store-feature";
import { ApiErrorCode, createErrorResponse } from "@/types/api/responses";

/**
 * Who may read a store's Finance figures, beyond the plan.
 *
 * A PIN persona rides the OWNER's session, so store auth alone can't tell the
 * owner from the cashier on the shared iPad — the page grant
 * (requireStaffPageAccess "/finance") only protected the page, and the report
 * routes answered anyone. The rule, shared by the routes and the page:
 * - no persona, or the OWNER persona: the owner — allowed;
 * - a persona from ANOTHER outlet: refused. Finance is per outlet, and a
 *   manager of one outlet reading another's P&L is exactly what the owner-only
 *   All outlets scope exists to prevent;
 * - a persona from this outlet: allowed only with one of `pages` granted.
 *
 * Linked staff accounts never get here: the staff-principal policy table
 * default-denies every finance report route.
 */
export function staffPersonaMayReadFinance(
  staffSession: Pick<ActiveStaffSession, "storeId" | "role" | "allowedPages"> | null,
  storeId: string,
  pages: string[] = ["/finance"]
): boolean {
  if (!staffSession || staffSession.role === "OWNER") return true;
  if (staffSession.storeId !== storeId) return false;
  return pages.some((page) => staffSession.allowedPages.includes(page));
}

/**
 * API gate for the Finance report routes: the plan (FEATURE_MIN_PLAN.finance,
 * judged on the store owner's subscription), then the persona rule above.
 *
 *   const gate = await requireFinanceReportAccessApi(storeId!);
 *   if (gate) return gate;
 *
 * @param pages the page grants that unlock this route for a same-outlet
 *   persona — /shifts also reads cash reconciliation, so it passes both.
 * @returns a 403 response to return immediately, or null to proceed.
 */
export async function requireFinanceReportAccessApi(
  storeId: string,
  pages: string[] = ["/finance"]
): Promise<NextResponse | null> {
  const planGate = await requireStoreFeatureApi(storeId, "finance", "Finance reports");
  if (planGate) return planGate;

  const staffSession = await getActiveStaffSession();
  if (staffPersonaMayReadFinance(staffSession, storeId, pages)) return null;

  return NextResponse.json(
    createErrorResponse(ApiErrorCode.FORBIDDEN, "Your staff access doesn't include this report."),
    { status: 403 }
  );
}
