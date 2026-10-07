import { NextResponse } from "next/server";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { getActiveStaffSession } from "@/lib/staff-session";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { requireFinanceReportAccessApi } from "@/lib/auth/require-finance-access";

/**
 * Who may add, change or delete an expense: a manager or the owner, working
 * on THIS store, on a plan with Finance.
 *
 * The explicit store check is not redundant — requireManagerOrOwnerApi treats
 * a staff session for a different store as "no session" and lets it through
 * whenever the owner's sign-in covers both stores (see the cash-movements
 * DELETE route). Expenses change reported profit, so a persona must be
 * operating on the store whose books it edits.
 */
export async function requireExpenseWriteAccess(storeId: string): Promise<NextResponse | null> {
  const staffSession = await getActiveStaffSession();
  if (staffSession && staffSession.storeId !== storeId) {
    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.FORBIDDEN,
        "Switch to this store before changing its expenses"
      ),
      { status: 403 }
    );
  }
  const guardResponse = await requireManagerOrOwnerApi(storeId);
  if (guardResponse) return guardResponse;
  return requireFinanceReportAccessApi(storeId);
}
