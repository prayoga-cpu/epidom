import type { PosOrderDisplay } from "../types/pos.types";

export type QueueView = "grid" | "compact" | "board";

export type QueueStatusFilter = "ALL" | "CONFIRMED" | "IN_PRODUCTION" | "READY" | "HELD";

export type QueueSourceFilter = "ALL" | "POS" | "ONLINE";

export type QueueTypeFilter = "ALL" | "DINE_IN" | "TAKEAWAY" | "DELIVERY";

// "CUSTOM" is the optional second product line (Product.productLine) — not
// a real stored department, matched via productLine instead of the
// department field itself (see matchesQueueFilters below).
export type QueueDepartmentFilter = "ALL" | "KITCHEN" | "BAR" | "CUSTOM";

// Mirrors the Prisma PaymentMethod enum as plain strings — same reasoning as
// QUEUE_STATUSES above: that enum type isn't safe to import into client bundles.
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
// status is excluded since it's driven by the always-visible tiles, not a
// dropdown in this set.
export const QUEUE_FILTER_KEYS = [
  "source",
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
  order: PosOrderDisplay,
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
  if (sourceFilter !== "ALL") {
    const bucket = order.source === "POS" ? "POS" : "ONLINE";
    if (bucket !== sourceFilter) return false;
  }
  if (typeFilter !== "ALL" && order.orderType !== typeFilter) return false;
  if (unpaidOnly && order.paymentStatus !== "PENDING") return false;
  if (paymentMethodFilter !== "ALL" && order.paymentMethod !== paymentMethodFilter) return false;
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
    const haystack = [order.orderNumber, order.customerName, order.tableLabel, order.tableNumber]
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
