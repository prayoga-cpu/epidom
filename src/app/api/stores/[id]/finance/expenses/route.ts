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
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { requireFinanceReportAccessApi } from "@/lib/auth/require-finance-access";
import { createExpenseSchema } from "@/lib/validation/expense.schemas";
import { expenseDateWindow, summarizeExpenses } from "@/lib/finance/expenses";
import { requireExpenseWriteAccess } from "@/lib/auth/require-expense-write-access";

export const dynamic = "force-dynamic";

const EXPENSE_SELECT = {
  id: true,
  date: true,
  category: true,
  description: true,
  amount: true,
  createdAt: true,
} as const;

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

    const expenses = await prisma.expense.findMany({
      where: { storeId, date: expenseDateWindow(from, to) },
      select: EXPENSE_SELECT,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    const rows = expenses.map((e) => ({
      ...e,
      date: e.date.toISOString().slice(0, 10),
      amount: Number(e.amount),
    }));

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

    const { date, category, description, amount } = parsed.data;
    const expense = await prisma.expense.create({
      data: {
        storeId: storeId!,
        date: new Date(`${date}T00:00:00Z`),
        category,
        description,
        amount,
      },
      select: EXPENSE_SELECT,
    });

    return NextResponse.json(
      createSuccessResponse({
        ...expense,
        date: expense.date.toISOString().slice(0, 10),
        amount: Number(expense.amount),
      }),
      { status: 201 }
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/expenses", requireStoreAuth: true }
);
