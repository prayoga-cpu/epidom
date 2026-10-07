/**
 * PATCH  /api/stores/[id]/finance/expenses/[expenseId]
 * DELETE /api/stores/[id]/finance/expenses/[expenseId]
 *
 * Correct or remove one recorded expense. Manager/owner only, on this store;
 * both are on the audit trail (see ROUTE_ACTION_MAP) since they change the
 * profit the business reports.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { updateExpenseSchema } from "@/lib/validation/expense.schemas";
import { requireExpenseWriteAccess } from "@/lib/auth/require-expense-write-access";

export const dynamic = "force-dynamic";

const notFound = () =>
  NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Expense not found"), {
    status: 404,
  });

/** Tenant check: the id arrives straight off the path. */
async function findOwnExpense(storeId: string, expenseId: string) {
  return prisma.expense.findFirst({ where: { id: expenseId, storeId }, select: { id: true } });
}

export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const { expenseId } = params as { expenseId: string };
    const denied = await requireExpenseWriteAccess(storeId!);
    if (denied) return denied;

    const parsed = updateExpenseSchema.safeParse(await request.json());
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
    if (!(await findOwnExpense(storeId!, expenseId))) return notFound();

    const { date, ...rest } = parsed.data;
    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: { ...rest, ...(date && { date: new Date(`${date}T00:00:00Z`) }) },
      select: { id: true, date: true, category: true, description: true, amount: true },
    });

    return NextResponse.json(
      createSuccessResponse({
        ...expense,
        date: expense.date.toISOString().slice(0, 10),
        amount: Number(expense.amount),
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/expenses/[expenseId]", requireStoreAuth: true }
);

export const DELETE = withApiHandler(
  async (_request, { storeId, params }) => {
    const { expenseId } = params as { expenseId: string };
    const denied = await requireExpenseWriteAccess(storeId!);
    if (denied) return denied;

    if (!(await findOwnExpense(storeId!, expenseId))) return notFound();
    await prisma.expense.delete({ where: { id: expenseId } });

    return NextResponse.json(createSuccessResponse({ id: expenseId, deleted: true }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/expenses/[expenseId]", requireStoreAuth: true }
);
