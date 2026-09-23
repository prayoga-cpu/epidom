import type { Prisma, OrderItemStatus } from "@prisma/client";

/**
 * Atomically CLAIM a state transition on one order, inside a transaction.
 *
 * Reading an order's status and then writing to it in a separate statement is
 * a lost-update race: two tills finalizing the same held bill, two "Mark as
 * Paid" taps, two cancels. Both readers see the old status, both proceed, and
 * the second one double-spends a coupon use, double-writes a tender row, or
 * reverses loyalty twice. The guard has to BE the write.
 *
 * `updateMany` is what makes that possible — `update` throws on a miss and
 * takes no extra WHERE — and Postgres row-locks the matched row until commit,
 * so a concurrent claim blocks and then re-evaluates the guard against the
 * committed row. Exactly one caller gets `true`.
 *
 * ALWAYS call this as the first statement in the transaction, before any
 * bookkeeping: everything that follows is conditional on having won.
 * `storeId` is folded in so a claim can never cross tenants.
 */
export async function claimOrderTransition(
  tx: Prisma.TransactionClient,
  args: {
    orderId: string;
    storeId: string;
    /** The state the row must STILL be in. Scalar filters only (updateMany). */
    guard: Prisma.OrderWhereInput;
    data: Prisma.OrderUpdateManyMutationInput;
  }
): Promise<boolean> {
  const claimed = await tx.order.updateMany({
    where: { ...args.guard, id: args.orderId, storeId: args.storeId },
    data: args.data,
  });
  return claimed.count === 1;
}

/**
 * The batch form, for an operation that is only valid if EVERY order is still
 * in the expected state (merge). All-or-nothing on purpose: a partial claim
 * would fold half the bills and silently drop the rest. Pass DEDUPED ids — a
 * repeated id inflates the expected count and would always report failure.
 */
export async function claimOrderTransitions(
  tx: Prisma.TransactionClient,
  args: {
    orderIds: string[];
    storeId: string;
    guard: Prisma.OrderWhereInput;
    data: Prisma.OrderUpdateManyMutationInput;
  }
): Promise<boolean> {
  if (args.orderIds.length === 0) return true;
  const claimed = await tx.order.updateMany({
    where: { ...args.guard, id: { in: args.orderIds }, storeId: args.storeId },
    data: args.data,
  });
  return claimed.count === args.orderIds.length;
}

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
 *
 * A POS **Custom Item** (`customLine`, an ad-hoc line the cashier typed —
 * unrelated to Product.productLine despite the shared word) has no MenuItem
 * to take a department from, so it carries its own: a prep area means it
 * really does get made and starts PENDING, and no prep area is the same
 * "nothing will ever move it off PENDING" situation as above ⇒ SERVED.
 */
export function resolveInitialOrderItemStatus(
  productLine: "STANDARD" | "CUSTOM" | null | undefined,
  customLine?: { isCustom?: boolean; department?: "KITCHEN" | "BAR" | "BOTH" | null }
): OrderItemStatus {
  if (customLine?.isCustom) return customLine.department ? "PENDING" : "SERVED";
  return productLine === "CUSTOM" ? "SERVED" : "PENDING";
}
