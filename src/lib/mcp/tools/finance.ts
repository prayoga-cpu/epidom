import { z } from "zod";
import { ExpenseCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { loadChannelRows } from "@/lib/finance/channel-report";
import { buildSalesPatterns } from "@/lib/finance/insights";
import { computeStoreFinanceSummary } from "@/lib/finance/store-summary";
import { summarizeExpenses } from "@/lib/finance/expenses";
import { createExpenseSchema } from "@/lib/validation/expense.schemas";
import { createExpense, listExpenses } from "@/lib/services/expense.service";
import { getFinanceSettings } from "@/lib/services/finance-settings.service";
import { defineAccountTool, defineStoreTool } from "../define-tool";
import { McpToolError } from "../errors";
import { periodInput, resolveRange } from "../range";
import { listConnectorStores } from "../stores";
import { money, PAGES, storeIdInput, storeTimezone } from "./shared";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const getSalesBreakdown = defineStoreTool({
  name: "get_sales_breakdown",
  title: "Sales breakdown",
  description:
    "Split a period's sales by one dimension: channel (till, storefront, each delivery app, with the " +
    "app's estimated commission and net revenue), order_type (dine-in, takeaway, delivery, with guests " +
    "and revenue per guest), hour of day or weekday (in the business's timezone).",
  input: z.object({
    ...storeIdInput,
    ...periodInput,
    by: z.enum(["channel", "order_type", "hour", "weekday"]),
  }),
  kind: "read",
  access: { pages: PAGES.finance, feature: "finance" },
  handler: async (input, ctx) => {
    const timezone = await storeTimezone(ctx);
    const range = resolveRange(input, timezone);
    const { currency } = await getFinanceSettings(ctx.storeId);
    const period = { firstDay: range.fromKey, lastDay: range.toKey, timezone };

    if (input.by === "channel") {
      const rows = await loadChannelRows(ctx.storeId, range);
      return {
        currency,
        period,
        rows: rows.map((row) => ({
          channel: row.label,
          orders: row.orderCount,
          revenue: money(row.revenue),
          commissionPercent: row.commissionPct,
          commission: money(row.commissionAmount),
          refunds: money(row.refundAmount),
          netRevenue: money(row.netRevenue),
        })),
      };
    }

    // The same orders the Sales Patterns report reads.
    const orders = await prisma.order.findMany({
      where: {
        storeId: ctx.storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        orderDate: { gte: range.from, lte: range.to },
      },
      select: { orderDate: true, total: true, orderType: true, guestCount: true },
    });
    const patterns = buildSalesPatterns(orders, timezone);

    if (input.by === "order_type") {
      return {
        currency,
        period,
        rows: patterns.byOrderType,
        covers: {
          guests: patterns.covers.guests,
          revenuePerGuest:
            patterns.covers.guests > 0
              ? money(patterns.covers.revenueWithGuests / patterns.covers.guests)
              : null,
        },
      };
    }
    if (input.by === "hour") {
      return {
        currency,
        period,
        rows: patterns.byHour.map((row) => ({
          hour: row.hour,
          orders: row.orderCount,
          revenue: money(row.revenue),
        })),
      };
    }
    return {
      currency,
      period,
      rows: patterns.byWeekday.map((row) => ({
        weekday: WEEKDAYS[row.weekday] ?? row.weekday,
        orders: row.orderCount,
        revenue: money(row.revenue),
      })),
    };
  },
});

export const listExpensesTool = defineStoreTool({
  name: "list_expenses",
  title: "Expenses",
  description:
    "Operating expenses recorded in Finance → Expenses for a period (default this month), newest first, " +
    "with totals per category. These come off net profit in the Finance page's P&L.",
  input: z.object({ ...storeIdInput, ...periodInput }),
  kind: "read",
  access: { pages: PAGES.finance, feature: "finance" },
  handler: async (input, ctx) => {
    const range = resolveRange(
      { ...input, period: input.period ?? "this_month" },
      await storeTimezone(ctx)
    );
    const [rows, { currency }] = await Promise.all([
      listExpenses(ctx.storeId, range.from, range.to),
      getFinanceSettings(ctx.storeId),
    ]);
    const summary = summarizeExpenses(rows);
    return {
      currency,
      period: { firstDay: range.fromKey, lastDay: range.toKey },
      expenses: rows.map((e) => ({
        expenseId: e.id,
        date: e.date,
        category: e.category,
        description: e.description,
        amount: money(e.amount),
      })),
      summary,
    };
  },
});

export const recordExpense = defineStoreTool({
  name: "record_expense",
  title: "Record an expense",
  description:
    "Add an operating expense (rent, utilities, salaries, marketing, supplies, maintenance, insurance, " +
    "fees, other) for a day, in the store's currency. Read it from a receipt or invoice only if every " +
    "figure is legible; ask otherwise.",
  input: z.object({
    ...storeIdInput,
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("The day it belongs to, YYYY-MM-DD."),
    category: z.nativeEnum(ExpenseCategory),
    amount: z.number().positive(),
    description: z.string().max(200).optional(),
  }),
  kind: "write",
  access: { pages: PAGES.finance, managerOnly: true, feature: "finance" },
  hints: { destructiveHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    const parsed = createExpenseSchema.safeParse({
      date: input.date,
      category: input.category,
      amount: input.amount,
      description: input.description,
    });
    if (!parsed.success) {
      throw new McpToolError("INVALID_INPUT", parsed.error.issues.map((i) => i.message).join("; "));
    }
    const [expense, { currency }] = await Promise.all([
      createExpense(ctx.storeId, parsed.data),
      getFinanceSettings(ctx.storeId),
    ]);
    return {
      expenseId: expense.id,
      date: expense.date,
      category: expense.category,
      amount: money(expense.amount),
      currency,
    };
  },
});

export const getAllOutletsSummary = defineAccountTool({
  name: "get_all_outlets_summary",
  title: "All outlets",
  description:
    "Sales and profit for every store the account owns (the Finance page's All outlets view) for one " +
    "period, side by side. Totals are given only when every outlet uses the same currency. Stores not " +
    "on a plan that includes Claude are listed without figures. Owners only.",
  input: z.object(periodInput),
  handler: async (input, { principal }) => {
    const stores = (await listConnectorStores(principal.userId)).filter((s) => s.role === "owner");
    if (stores.length === 0) {
      throw new McpToolError("FORBIDDEN", "Only a business owner has an all-outlets view.");
    }
    const timezone = stores[0].timezone;
    const range = resolveRange(input, timezone);

    const outlets = await Promise.all(
      stores.map(async (store) => {
        if (!store.connectorEnabled)
          return { storeId: store.storeId, name: store.name, locked: true };
        const s = await computeStoreFinanceSummary(store.storeId, range);
        return {
          storeId: store.storeId,
          name: store.name,
          currency: s.currency,
          sales: money(s.revenue),
          netSales: money(s.netSales),
          grossProfit: money(s.grossProfit),
          netProfit: money(s.netProfit),
          orders: s.orderCount,
          raw: s,
        };
      })
    );

    const priced = outlets.filter((o): o is Extract<typeof o, { raw: unknown }> => "raw" in o);
    const currencies = new Set(priced.map((o) => o.currency));
    const sum = (pick: (s: (typeof priced)[number]["raw"]) => number) =>
      money(priced.reduce((total, o) => total + pick(o.raw), 0));

    return {
      period: { firstDay: range.fromKey, lastDay: range.toKey, timezone },
      outlets: outlets.map((o) => ("raw" in o ? { ...o, raw: undefined } : o)),
      totals:
        priced.length > 0 && currencies.size === 1
          ? {
              currency: [...currencies][0],
              sales: sum((s) => s.revenue),
              netSales: sum((s) => s.netSales),
              grossProfit: sum((s) => s.grossProfit),
              netProfit: sum((s) => s.netProfit),
              orders: priced.reduce((total, o) => total + o.orders, 0),
            }
          : null,
      note:
        currencies.size > 1 ? "Outlets use different currencies, so there is no total." : undefined,
    };
  },
});
