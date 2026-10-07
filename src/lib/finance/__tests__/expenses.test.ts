import { describe, it, expect } from "vitest";
import { expenseDateWindow, summarizeExpenses } from "../expenses";
import { createExpenseSchema, updateExpenseSchema } from "@/lib/validation/expense.schemas";

describe("expenseDateWindow", () => {
  it("widens a report window to the whole days it touches", () => {
    const w = expenseDateWindow(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-31T23:59:59Z"));
    expect(w.gte.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(w.lte.toISOString()).toBe("2026-10-31T00:00:00.000Z");
  });

  it("covers the day of a till session's exact open-to-close window", () => {
    const w = expenseDateWindow(new Date("2026-10-05T01:30:00Z"), new Date("2026-10-05T14:10:00Z"));
    expect(w.gte.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(w.lte.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
});

describe("summarizeExpenses", () => {
  it("totals the ledger and subtotals it by category, biggest first", () => {
    expect(
      summarizeExpenses([
        { category: "RENT", amount: 1000 },
        { category: "UTILITIES", amount: "120.10" },
        { category: "UTILITIES", amount: 80.2 },
      ])
    ).toEqual({
      total: 1200.3,
      byCategory: [
        { category: "RENT", count: 1, amount: 1000 },
        { category: "UTILITIES", count: 2, amount: 200.3 },
      ],
    });
  });
});

describe("createExpenseSchema", () => {
  it("accepts a day, a category and a positive amount, rounding to the cent", () => {
    const parsed = createExpenseSchema.parse({
      date: "2026-10-05",
      category: "RENT",
      amount: "1500.555",
      description: "  ",
    });
    expect(parsed).toEqual({
      date: "2026-10-05",
      category: "RENT",
      amount: 1500.56,
      description: null,
    });
  });

  it("rejects a zero amount, a datetime and an unknown category", () => {
    expect(
      createExpenseSchema.safeParse({ date: "2026-10-05", category: "RENT", amount: 0 }).success
    ).toBe(false);
    expect(
      createExpenseSchema.safeParse({ date: "2026-10-05T10:00:00Z", category: "RENT", amount: 1 })
        .success
    ).toBe(false);
    expect(
      createExpenseSchema.safeParse({ date: "2026-10-05", category: "FOOD", amount: 1 }).success
    ).toBe(false);
  });

  it("refuses an empty update", () => {
    expect(updateExpenseSchema.safeParse({}).success).toBe(false);
    expect(updateExpenseSchema.safeParse({ amount: 10 }).success).toBe(true);
  });
});
