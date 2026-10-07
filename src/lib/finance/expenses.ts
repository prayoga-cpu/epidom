/**
 * Pure helpers for the Finance Expenses ledger — kept DB-free so the date
 * window and the per-category roll-up are unit-tested (see
 * __tests__/expenses.test.ts).
 */
import type { ExpenseCategory } from "@prisma/client";

/** Every category, in the order the form and the report list them. */
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "RENT",
  "UTILITIES",
  "SALARIES",
  "MARKETING",
  "SUPPLIES",
  "MAINTENANCE",
  "INSURANCE",
  "FEES",
  "OTHER",
];

/**
 * The calendar days an expense query covers. Expenses are dated by day, so a
 * report window — `T00:00:00Z`…`T23:59:59Z`, or a till session's exact
 * open→close — is widened to the whole UTC days it touches, the same days the
 * Daily tab buckets orders into.
 */
export function expenseDateWindow(from: Date, to: Date): { gte: Date; lte: Date } {
  const day = (instant: Date) => new Date(`${instant.toISOString().slice(0, 10)}T00:00:00Z`);
  return { gte: day(from), lte: day(to) };
}

export interface ExpenseCategoryTotal {
  category: ExpenseCategory;
  count: number;
  amount: number;
}

/** Total and per-category subtotals, biggest first. */
export function summarizeExpenses(
  expenses: { category: ExpenseCategory; amount: number | string | { toString(): string } }[]
): { total: number; byCategory: ExpenseCategoryTotal[] } {
  const groups = new Map<ExpenseCategory, ExpenseCategoryTotal>();
  let total = 0;
  for (const expense of expenses) {
    const amount = Number(expense.amount);
    const group = groups.get(expense.category) ?? {
      category: expense.category,
      count: 0,
      amount: 0,
    };
    group.count += 1;
    group.amount += amount;
    groups.set(expense.category, group);
    total += amount;
  }
  return {
    total: Math.round(total * 100) / 100,
    byCategory: Array.from(groups.values())
      .map((g) => ({ ...g, amount: Math.round(g.amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount),
  };
}
