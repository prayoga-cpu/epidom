import { OrderStatus, Prisma } from "@prisma/client";

/**
 * Orders visible in the POS Active Queue / KDS shared feed (GET + SSE).
 * KDS itself further narrows this down client-side by exact status match, so
 * HELD orders reach the feed but never appear in a KDS column.
 */
export const ACTIVE_POS_STATUSES: OrderStatus[] = [
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY",
  "HELD",
];

/**
 * Where-clause fragment for the POS Active Queue / KDS shared feed: every
 * order in an active production status, PLUS delivered orders still awaiting
 * payment. Delivered-but-unpaid orders would otherwise vanish from the
 * cashier's view the moment they're marked Delivered — this keeps them
 * visible on the Active tab so staff can follow up with the customer to pay,
 * instead of the order only being findable in Order History.
 */
export const ACTIVE_POS_QUEUE_FILTER: Prisma.OrderWhereInput = {
  OR: [{ status: { in: ACTIVE_POS_STATUSES } }, { status: "DELIVERED", paymentStatus: "PENDING" }],
};

/**
 * Orders excluded from revenue/order-count aggregation — unpaid or dead.
 * A single source of truth so a future new OrderStatus value can't silently
 * get counted as revenue by being missing from one of the many report queries.
 */
export const NON_REVENUE_STATUSES: OrderStatus[] = ["CANCELLED", "HELD"];
