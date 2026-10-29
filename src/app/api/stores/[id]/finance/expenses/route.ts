/**
 * GET  /api/stores/[id]/finance/expenses
 * POST /api/stores/[id]/finance/expenses
 *
 * The Expenses ledger: operating costs (rent, utilities, wages paid, ...)
 * recorded per day, which the Finance P&L subtracts from net profit.
 *
 * GET query params: from, to (the report window; widened to whole days).
 * Reading follows the Finance report rule; writing is manager/owner only.
 */
import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { requireFinanceReportAccessApi } from "@/lib/auth/require-finance-access";
import { createExpenseSchema } from "@/lib/validation/expense.schemas";
import { summarizeExpenses } from "@/lib/finance/expenses";
import { createExpense, listExpenses } from "@/lib/services/expense.service";
import { requireExpenseWriteAccess } from "@/lib/auth/require-expense-write-access";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const gate = await requireFinanceReportAccessApi(storeId!);
    if (gate) return gate;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const from = new Date(
      searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    );
    const to = new Date(searchParams.get("to") ?? now.toISOString());
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid date range"),
        { status: 400 }
      );
    }

    const rows = await listExpenses(storeId!, from, to);

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        expenses: rows,
        ...summarizeExpenses(rows),
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/expenses", requireStoreAuth: true }
);

export const POST = withApiHandler(
  async (request, { storeId }) => {
    const denied = await requireExpenseWriteAccess(storeId!);
    if (denied) return denied;

    const parsed = createExpenseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Validation failed",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    const expense = await createExpense(storeId!, parsed.data);

    return NextResponse.json(
      createSuccessResponse(expense),
      { status: 201 }
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/expenses", requireStoreAuth: true }
);
