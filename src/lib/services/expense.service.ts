import { prisma } from "@/lib/prisma";
import { expenseDateWindow } from "@/lib/finance/expenses";
import type { CreateExpenseInput } from "@/lib/validation/expense.schemas";

/**
 * The Expenses ledger (Finance → Expenses): operating costs recorded per day,
 * which the P&L subtracts from net profit. Amounts are literal in the store's
 * own currency. Shared by /finance/expenses and the Claude connector.
 */

export const EXPENSE_SELECT = {
  id: true,
  date: true,
  category: true,
  description: true,
  amount: true,
  createdAt: true,
} as const;

/** Expenses on the days the window touches, newest first, as plain rows. */
export async function listExpenses(storeId: string, from: Date, to: Date) {
  const expenses = await prisma.expense.findMany({
    where: { storeId, date: expenseDateWindow(from, to) },
    select: EXPENSE_SELECT,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return expenses.map((e) => ({
    ...e,
    date: e.date.toISOString().slice(0, 10),
    amount: Number(e.amount),
  }));
}

/** Record one expense; `date` is the calendar day it belongs to. */
export async function createExpense(storeId: string, input: CreateExpenseInput) {
  const expense = await prisma.expense.create({
    data: {
      storeId,
      date: new Date(`${input.date}T00:00:00Z`),
      category: input.category,
      description: input.description,
      amount: input.amount,
    },
    select: EXPENSE_SELECT,
  });
  return {
    ...expense,
    date: expense.date.toISOString().slice(0, 10),
    amount: Number(expense.amount),
  };
}
