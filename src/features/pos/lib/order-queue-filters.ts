import type { PosOrderDisplay } from "../types/pos.types";
import { DATE_RANGE_PRESETS, isWithinPreset, type DateRangePreset } from "./date-range-presets";

/**
 * How far back the queue looks. The same presets History offers, minus "custom" —
 * this is a live work queue, not a report. Always applied; see DEFAULT_QUEUE_DATE_PRESET.
 */
export type QueueDatePreset = Exclude<DateRangePreset, "custom">;

export const QUEUE_DATE_PRESETS: readonly QueueDatePreset[] = DATE_RANGE_PRESETS;

/** What everyone sees until they choose otherwise: today's orders, on their own clock. */
export const DEFAULT_QUEUE_DATE_PRESET: QueueDatePreset = "today";

/**
 * Whether an order was placed inside the date preset's window, measured on the
 * USER's clock (00:00 local, not UTC). Kept apart from matchesQueueFilters: it
 * scopes which orders the page is about at all — tab counts included — rather
 * than narrowing within them.
 */
export function matchesQueueDate(
  order: PosOrderDisplay,
  preset: QueueDatePreset,
  now: Date = new Date()
): boolean {
  return isWithinPreset(order.createdAt, preset, now);
}

// "split" is the three-column master–detail layout (status rail | order list |
// selected-order details); the other three are the original card/row/kanban views.
export type QueueView = "split" | "grid" | "compact" | "board";

export type QueueStatusFilter = "ALL" | "CONFIRMED" | "IN_PRODUCTION" | "READY" | "HELD";

export type QueueSourceFilter = "ALL" | "POS" | "ONLINE";

/** The two source tabs above the queue. There is deliberately no "All" tab. */
export type QueueSourceTab = Exclude<QueueSourceFilter, "ALL">;

export const QUEUE_SOURCE_TABS: readonly QueueSourceTab[] = ["POS", "ONLINE"];

/**
 * Which tab an order sits under: a walk-in rung up on the till is POS; anything
 * else (storefront, manual, GoFood/GrabFood/…) is Online. Same split the "Walk-in"
 * / "Online" source badge on the cards has always used.
 */
export function orderSourceBucket(source: string): QueueSourceTab {
  return source === "POS" ? "POS" : "ONLINE";
}

/** Open orders per tab, for the count badges. Independent of every other filter. */
export function countOrdersBySource(
  orders: ReadonlyArray<{ source: string }>
): Record<QueueSourceTab, number> {
  const counts: Record<QueueSourceTab, number> = { POS: 0, ONLINE: 0 };
  for (const o of orders) counts[orderSourceBucket(o.source)] += 1;
  return counts;
}

/**
 * A persisted filter from before the tabs existed can be "ALL" — with no "All"
 * tab to show it, fall back to POS rather than leaving no tab selected.
 */
export function toSourceTab(value: unknown): QueueSourceTab {
  return value === "ONLINE" ? "ONLINE" : "POS";
}

export type QueueTypeFilter = "ALL" | "DINE_IN" | "TAKEAWAY" | "DELIVERY";

// "CUSTOM" is the optional second product line (Product.productLine) — not
// a real stored department, matched via productLine instead of the
// department field itself (see matchesQueueFilters below).
export type QueueDepartmentFilter = "ALL" | "KITCHEN" | "BAR" | "CUSTOM";

/**
 * A queue order as this module needs it. `PosOrderDisplay` already carries the
 * optional per-tender rows (`payments`), so this is just the name the filter
 * signature uses — kept as an alias so the tender-aware payment filter below
 * reads as taking something with tenders on it.
 */
export type QueueOrder = PosOrderDisplay;

// Mirrors the Prisma PaymentMethod enum as plain strings — same reasoning as
// QUEUE_STATUSES above: that enum type isn't safe to import into client bundles.
// SPLIT is deliberately NOT a member: Order.paymentMethod carries it for a
// multi-tender bill, but "how did they pay" is answered by the tenders, and
// the filter below matches those instead (see matchesQueueFilters).
export type QueuePaymentMethodFilter =
  | "ALL"
  | "CASH"
  | "QRIS"
  | "GOPAY"
  | "OVO"
  | "DANA"
  | "SHOPEEPAY"
  | "BANK_TRANSFER"
  | "STRIPE_CARD"
  | "PAY_LATER";

export const QUEUE_PAYMENT_METHODS: Exclude<QueuePaymentMethodFilter, "ALL">[] = [
  "CASH",
  "QRIS",
  "GOPAY",
  "OVO",
  "DANA",
  "SHOPEEPAY",
  "BANK_TRANSFER",
  "STRIPE_CARD",
  "PAY_LATER",
];

export type QueueSortBy = "newest" | "oldest" | "total-desc" | "total-asc";

// Statuses that can appear in the active POS queue — mirrors
// ACTIVE_POS_STATUSES in lib/constants/order-status.ts, duplicated here as
// plain strings because that file pulls in the Prisma-generated OrderStatus
// type, which isn't safe to import into client bundles.
export const QUEUE_STATUSES: Exclude<QueueStatusFilter, "ALL">[] = [
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY",
  "HELD",
];

// The optional filter dropdowns hidden by default behind "+ Add filter" —
// status is excluded since it's driven by the always-visible tiles/rail, and
// source since it's the always-visible POS / Online tabs.
export const QUEUE_FILTER_KEYS = [
  "type",
  "department",
  "product",
  "staff",
  "paymentMethod",
] as const;
export type QueueFilterKey = (typeof QUEUE_FILTER_KEYS)[number];

interface QueueFilterParams {
  sourceFilter: QueueSourceFilter;
  typeFilter: QueueTypeFilter;
  search: string;
  unpaidOnly: boolean;
  productFilter: string; // "ALL" or a menuItemId
  departmentFilter: QueueDepartmentFilter;
  staffFilter: string; // "ALL" or a staffMemberId
  paymentMethodFilter: QueuePaymentMethodFilter;
}

// Source/type/search filters apply everywhere; matches the "Walk-in"/"Online"
// grouping already used for the source badge on PosOrderCard.
export function matchesQueueFilters(
  order: QueueOrder,
  {
    sourceFilter,
    typeFilter,
    search,
    unpaidOnly,
    productFilter,
    departmentFilter,
    staffFilter,
    paymentMethodFilter,
  }: QueueFilterParams
): boolean {
  if (sourceFilter !== "ALL" && orderSourceBucket(order.source) !== sourceFilter) return false;
  if (typeFilter !== "ALL" && order.orderType !== typeFilter) return false;
  if (unpaidOnly && order.paymentStatus !== "PENDING") return false;
  if (paymentMethodFilter !== "ALL") {
    // Mirrors the server-side filter (report-filters.ts / order-history-query.ts):
    // the whole-order method OR any tender. A split bill's paymentMethod is
    // "SPLIT", so matching on that alone would hide it from every method
    // filter even though a cashier did take cash for part of it.
    // An order with no rows (placed before multi-tender, or a zero-total /
    // Mark-as-Paid sale that never writes one) falls back to paymentMethod.
    const matches =
      order.paymentMethod === paymentMethodFilter ||
      (order.payments ?? []).some((p) => p.method === paymentMethodFilter);
    if (!matches) return false;
  }
  if (productFilter !== "ALL" && !order.items.some((i) => i.menuItemId === productFilter)) {
    return false;
  }
  if (departmentFilter !== "ALL") {
    const matchesDepartment =
      departmentFilter === "CUSTOM"
        ? (i: (typeof order.items)[number]) => i.menuItem?.product?.productLine === "CUSTOM"
        : (i: (typeof order.items)[number]) =>
            i.menuItem?.product?.productLine !== "CUSTOM" &&
            i.menuItem?.department === departmentFilter;
    if (!order.items.some(matchesDepartment)) return false;
  }
  if (staffFilter !== "ALL" && order.shift?.staffMember.id !== staffFilter) return false;
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    // The call-out number is searchable as "12" and "#12" alike.
    const queue =
      order.queueNumber != null ? [String(order.queueNumber), `#${order.queueNumber}`] : [];
    const haystack = [
      order.orderNumber,
      order.customerName,
      order.tableLabel,
      order.tableNumber,
      ...queue,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

export function sortQueueOrders(
  orders: PosOrderDisplay[],
  sortBy: QueueSortBy
): PosOrderDisplay[] {
  const list = [...orders];
  switch (sortBy) {
    case "oldest":
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case "total-desc":
      list.sort((a, b) => Number(b.total) - Number(a.total));
      break;
    case "total-asc":
      list.sort((a, b) => Number(a.total) - Number(b.total));
      break;
    default:
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  return list;
}
