/**
 * POST /api/stores/[id]/pos/orders/merge
 *
 * Luna-parity "Merge Bill": fold one or more Saved (HELD) bills into another
 * one. Deliberately narrow — HELD ↔ HELD only, so there is no KDS ticket to
 * re-route, no stock already deducted and no payment to reconcile.
 *
 * The source orders are CANCELLED, never deleted: Order is an immutable ledger
 * (there is no hard-delete path anywhere in this codebase), and CANCELLED is
 * already excluded from every revenue/finance report via NON_REVENUE_STATUSES.
 * Their discounts are dropped — the target's own discount is kept and
 * re-applied to the combined item total, which is what the dialog warns about.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { mergeOrdersSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { resolveFinanceSettingsForOrder } from "@/lib/services";
import {
  mapSettlementError,
  mergeHeldOrdersInTx,
  POS_ORDER_TX_TIMEOUT_MS,
} from "@/lib/services/pos-order-settlement";
import type { MergeOrdersResultDto } from "@/types/api/cashier";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";

/** A bill can only be merged while it is parked and unpaid. */
function isMergeable(order: { status: string; paymentStatus: string }): boolean {
  return order.status === "HELD" && order.paymentStatus !== "PAID";
}

export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = mergeOrdersSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Invalid merge data",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    // withApiHandler guarantees this when requireStoreAuth is set.
    const scopedStoreId = storeId as string;
    const { targetOrderId } = parsed.data;
    // Dedupe: the same bill listed twice would otherwise be "moved" twice and
    // inflate mergedCount, and its second move would be a no-op.
    const sourceOrderIds = [...new Set(parsed.data.sourceOrderIds)];

    if (sourceOrderIds.includes(targetOrderId)) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "A bill cannot be merged into itself"),
        { status: 400 }
      );
    }

    // storeId scope is on BOTH lookups — a merge is the one place where an
    // id from another tenant would silently move their items into this store.
    const [target, sources] = await Promise.all([
      prisma.order.findFirst({ where: { id: targetOrderId, storeId: scopedStoreId } }),
      prisma.order.findMany({ where: { id: { in: sourceOrderIds }, storeId: scopedStoreId } }),
    ]);

    if (!target || sources.length !== sourceOrderIds.length) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    // Fast 409s for the common case. NOT the race guard — a bill can be paid
    // between this read and the write; mergeHeldOrdersInTx re-claims both the
    // target and every source inside the transaction.
    if (!isMergeable(target)) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "The target bill is no longer saved"),
        { status: 409 }
      );
    }
    if (!sources.every(isMergeable)) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "Every merged bill must still be saved"),
        { status: 409 }
      );
    }

    const financeSettings = await resolveFinanceSettingsForOrder(scopedStoreId);

    let merged;
    try {
      merged = await prisma.$transaction(
        (tx) =>
          mergeHeldOrdersInTx(tx, {
            storeId: scopedStoreId,
            target: {
              id: target.id,
              orderNumber: target.orderNumber,
              discountAmount: target.discountAmount,
              tableId: target.tableId,
            },
            sources: sources.map((s) => ({ id: s.id, notes: s.notes, tableId: s.tableId })),
            financeSettings,
          }),
        { timeout: POS_ORDER_TX_TIMEOUT_MS }
      );
    } catch (err) {
      // A lost claim rolls the whole merge back — no items moved, nothing
      // cancelled — and comes back as a 409.
      const mapped = mapSettlementError(err);
      if (mapped) return mapped;
      throw err;
    }

    publishStoreEvent(scopedStoreId, REALTIME_EVENTS.ORDER_UPDATED, {
      action: "updated",
      entityId: merged.id,
    });

    const result: MergeOrdersResultDto = {
      orderId: merged.id,
      orderNumber: merged.orderNumber,
      mergedCount: sources.length,
      total: merged.total,
    };

    return NextResponse.json(createSuccessResponse(result));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/pos/orders/merge",
    requireStoreAuth: true,
  }
);
