import { OrderStatus } from "@prisma/client";

/**
 * Orders visible in the POS Active Queue / KDS shared feed (GET + SSE).
 * KDS itself further narrows this down client-side by exact status match, so
 * HELD orders reach the feed but never appear in a KDS column.
 */
export const ACTIVE_POS_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY",
  "HELD",
];

/**
 * Orders excluded from revenue/order-count aggregation — unpaid or dead.
 * A single source of truth so a future new OrderStatus value can't silently
 * get counted as revenue by being missing from one of the many report queries.
 */
export const NON_REVENUE_STATUSES: OrderStatus[] = ["CANCELLED", "HELD"];
