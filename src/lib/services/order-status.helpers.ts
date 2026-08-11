import type { Prisma, OrderItemStatus } from "@prisma/client";

/**
 * Shared by the KDS item-status route and ProductionBatch completion (for
 * ORDER_SHORTFALL batches): once every item on an order is READY/SERVED/
 * CANCELLED, the order itself auto-advances to READY. Both call sites need
 * the exact same check, so it lives here once rather than drifting apart.
 */
export async function advanceOrderToReadyIfAllItemsReady(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { status: true },
  });
  const allReady = items.every(
    (i) => i.status === "READY" || i.status === "SERVED" || i.status === "CANCELLED"
  );
  if (allReady) {
    await tx.order.update({ where: { id: orderId }, data: { status: "READY" } });
  }
}

/**
 * CUSTOM product-line items (the optional second product line — see
 * Product.productLine) have no kitchen/bar prep step — they're excluded from
 * the KDS UI entirely (see kds-department.ts's itemDepartment), so nothing
 * would ever move them off PENDING. They're created directly as SERVED
 * instead, since a service/good with no prep step is, by this feature's own
 * definition, already fulfilled the instant it's rung up — this also keeps
 * advanceOrderToReadyIfAllItemsReady correct.
 */
export function resolveInitialOrderItemStatus(
  productLine: "STANDARD" | "CUSTOM" | null | undefined
): OrderItemStatus {
  return productLine === "CUSTOM" ? "SERVED" : "PENDING";
}
