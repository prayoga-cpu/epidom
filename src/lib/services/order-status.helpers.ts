import type { Prisma } from "@prisma/client";

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
