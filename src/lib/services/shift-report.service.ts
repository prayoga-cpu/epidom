/**
 * Fetches everything a shift/daily report needs and hands it to the pure
 * aggregator in lib/finance/shift-report.ts.
 *
 * Single source of truth for all three render paths — the browser report page
 * (`/store/[storeId]/pos/orders/daily-report`), the ESC/POS thermal print, and
 * the JSON route (`/api/stores/[id]/reports/shift-report`) — so none of them
 * can drift into showing different totals for the same window.
 */

import { prisma } from "@/lib/prisma";
import { getFinanceSettings } from "@/lib/services/finance-settings.service";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { resolveShiftWindow } from "@/lib/finance/shift-window";
import {
  aggregateShiftReport,
  type ShiftReportCashDrawer,
  type ShiftReportData,
} from "@/lib/finance/shift-report";

/** Exactly the fields ShiftReportOrderInput needs — nothing heavier. */
const REPORT_ORDER_SELECT = {
  status: true,
  orderType: true,
  paymentMethod: true,
  guestCount: true,
  subtotal: true,
  discountAmount: true,
  serviceCharge: true,
  tax: true,
  processingFee: true,
  delivery: true,
  refundAmount: true,
  total: true,
  orderDate: true,
  items: {
    select: {
      name: true,
      quantity: true,
      total: true,
      menuItem: {
        select: { name: true, category: { select: { id: true, name: true } } },
      },
    },
  },
} as const;

export interface ShiftReportRequest {
  /** Scope to one till session. Its open→close window overrides from/to, and
   * unlocks the cash-drawer block. */
  shiftId?: string | null;
  /** Explicit window, used when no shiftId is given (e.g. "today" from the
   * History tab's own date filters). */
  from?: Date | null;
  to?: Date | null;
}

export type ShiftReportResult =
  | {
      ok: true;
      report: ShiftReportData;
      /** Cashier who ran the till session, when scoped to one. */
      shiftLabel: string | null;
      storeName: string;
      /** ISO 4217 the store's amounts are literally denominated in — orders
       * store no currency snapshot, so this is the store's current setting.
       * See build-receipt-data.ts for the same caveat. */
      currency: string;
    }
  | { ok: false; reason: "SHIFT_NOT_FOUND" };

/**
 * `shiftId` wins over `from`/`to` when both are supplied — picking a session
 * is a strictly more specific intent than the date range it sits inside.
 *
 * The window is a *time range*, not `Order.shiftId` linkage: storefront and
 * aggregator orders taken while the till was open carry `shiftId: null`, and
 * a daily report has to count them. See lib/finance/shift-window.ts.
 */
export async function buildShiftReport(
  storeId: string,
  request: ShiftReportRequest
): Promise<ShiftReportResult> {
  let window: { from: Date; to: Date; isOpen: boolean };
  let cashDrawer: ShiftReportCashDrawer | null = null;
  let shiftLabel: string | null = null;

  if (request.shiftId) {
    const shift = await prisma.shift.findUnique({
      where: { id: request.shiftId },
      include: { staffMember: { select: { name: true } } },
    });
    // Tenant check is not optional here — shiftId arrives straight off a query
    // string, and every query in this repo scopes to storeId (AGENTS.md §6).
    if (!shift || shift.storeId !== storeId) return { ok: false, reason: "SHIFT_NOT_FOUND" };

    window = resolveShiftWindow(shift);
    shiftLabel = shift.staffMember?.name ?? null;
    cashDrawer = {
      staffName: shift.staffMember?.name ?? null,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt?.toISOString() ?? null,
      openingCash: Number(shift.openingCash),
      closingCash: shift.closingCash != null ? Number(shift.closingCash) : null,
      expectedCash: shift.expectedCash != null ? Number(shift.expectedCash) : null,
      cashDifference: shift.cashDifference != null ? Number(shift.cashDifference) : null,
    };
  } else {
    const now = new Date();
    // Default to "today so far" rather than all-time — an unscoped report over
    // a store's entire history is never what a daily-report button means.
    const from = request.from ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = request.to ?? now;
    window = { from, to, isOpen: false };
  }

  const dateRange = { gte: window.from, lte: window.to };

  const [store, financeSettings, orders, cancelledOrders] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId }, select: { name: true } }),
    getFinanceSettings(storeId),
    prisma.order.findMany({
      where: { storeId, status: { notIn: NON_REVENUE_STATUSES }, orderDate: dateRange },
      select: REPORT_ORDER_SELECT,
      orderBy: { orderDate: "asc" },
    }),
    prisma.order.findMany({
      where: { storeId, status: "CANCELLED", orderDate: dateRange },
      select: REPORT_ORDER_SELECT,
      orderBy: { orderDate: "asc" },
    }),
  ]);

  return {
    ok: true,
    // Prisma Decimals satisfy ShiftReportOrderInput's DecimalLike fields
    // directly — they stringify losslessly and the aggregator Number()s them.
    report: aggregateShiftReport({ orders, cancelledOrders, window, cashDrawer }),
    shiftLabel,
    storeName: store?.name ?? "",
    currency: financeSettings.currency,
  };
}
