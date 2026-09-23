import { NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { verifyStoreAccessWithResponse } from "@/lib/utils/store-verification";
import { updateOrderStatusSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { deductStockForOrder, reverseStockForOrder } from "@/lib/services/stock-deduction.service";
import { cancelOrderInTx, settlePendingOrderInTx } from "@/lib/services/pos-order-settlement";
import { serializePosOrder } from "@/lib/server/serialize";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";
import type { PaymentMethod } from "@prisma/client";

/**
 * The method to record on the OrderPayment row written when a PENDING order is
 * manually settled. Returns null when nothing real can be named — PAY_LATER
 * and SPLIT are not ways money changed hands, and inventing CASH there would
 * quietly inflate the drawer's expected cash. With no row, readers fall back
 * to Order.paymentMethod/total exactly as they do for every pre-2.88.0 order.
 */
function resolveSettleTenderMethod(
  requested: PaymentMethod | undefined,
  existing: PaymentMethod
): PaymentMethod | null {
  if (requested) return requested;
  return existing === "PAY_LATER" || existing === "SPLIT" ? null : existing;
}

/**
 * PATCH /api/stores/[id]/pos/orders/[orderId]
 * Update POS order status (used by order queue and KDS)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const { id: storeId, orderId } = await params;

  const session = await requireSessionApi();
  if (session instanceof NextResponse) return session;

  const storeAccess = await verifyStoreAccessWithResponse(storeId, session.user.id, request);
  if (storeAccess instanceof NextResponse) return storeAccess;
  const verification = storeAccess.store;

  try {
    const body = await request.json();
    const parsed = updateOrderStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid status", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const { status, paymentStatus, paymentMethod, paymentNote, foodWasNeverMade } = parsed.data;

    // Verify order belongs to this store
    const existing = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { table: true, payments: { select: { id: true } } },
    });

    if (!existing) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    if (status === "CANCELLED" && existing.status === "CANCELLED") {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Order is already cancelled"),
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (paymentNote !== undefined) updateData.paymentNote = paymentNote || null;

    // When delivering, mark timestamp and free up the table
    if (status === "DELIVERED") {
      updateData.deliveredDate = new Date();
    }

    // "Mark as Paid" on an order that never recorded a tender (Pay Later, or a
    // payment collected outside the online flow). Every settled order should
    // carry at least one OrderPayment row from 2.88.0 on, so the cash drawer
    // and the method breakdowns can read rows instead of guessing from
    // Order.paymentMethod. The METHOD is decided here; whether a row is
    // written at all is decided by the claim inside the transaction, because
    // `existing` was read outside it and two concurrent PATCHes both see
    // PENDING.
    const tenderMethod =
      paymentStatus === "PAID"
        ? resolveSettleTenderMethod(paymentMethod, existing.paymentMethod)
        : null;

    const updated = await prisma.$transaction(async (tx) => {
      // Claim the PENDING → PAID transition. Only the winner writes the tender
      // row and credits points; the loser's PATCH still succeeds (the order is
      // paid either way) but does no money work.
      if (paymentStatus === "PAID") {
        await settlePendingOrderInTx(tx, {
          orderId,
          storeId,
          tenderMethod,
          paymentNote,
          hasExistingPayments: existing.payments.length > 0,
        });
      }

      // Claim the cancel the same way: reverseLoyaltyForOrder's coupon release
      // is explicitly at-most-once-per-transition, so two concurrent cancels
      // would otherwise hand the same coupon use back twice. The "already
      // cancelled" check above is a fast 400, not a guard.
      if (status === "CANCELLED") {
        await cancelOrderInTx(tx, { orderId, storeId });
      }

      const order = await tx.order.update({
        where: { id: orderId },
        data: updateData,
      });

      // Free table when order is delivered or cancelled. updateMany so the
      // write is store-scoped.
      if ((status === "DELIVERED" || status === "CANCELLED") && existing.tableId) {
        await tx.table.updateMany({
          where: { id: existing.tableId, storeId },
          data: { status: "AVAILABLE" },
        });
      }

      return order;
    });

    publishStoreEvent(storeId, REALTIME_EVENTS.ORDER_UPDATED, {
      action: "updated",
      entityId: updated.id,
    });

    // Deduct ingredient stock when order is completed (Synchronous to prevent race conditions)
    if (status === "DELIVERED") {
      try {
        await deductStockForOrder(updated.id, storeId);
      } catch (err) {
        console.error("[STOCK_DEDUCTION]", err);
      }
    }

    // Cancelling an order that already had stock deducted must restore it.
    //
    // Deliberately NOT gated on `existing.status === "DELIVERED"`: the POS
    // schema permits DELIVERED → READY, and after that transition a cancel
    // would never reverse anything, silently stranding the deduction. The
    // service's own ledger guard (an unreversed SALE movement) is the
    // authority on whether there is anything to give back, so it is safe to
    // call unconditionally on cancel — it no-ops when there is not.
    //
    // `foodWasNeverMade` is asymmetric on purpose: deduction fires at
    // DELIVERED, i.e. after the food was made and handed over, so finished
    // goods go back on the shelf but raw ingredients do NOT — they are
    // physically inside food in a bin. Only the operator can say otherwise.
    if (status === "CANCELLED") {
      try {
        await reverseStockForOrder(updated.id, storeId, {
          foodWasNeverMade: foodWasNeverMade === true,
        });
      } catch (err) {
        console.error("[STOCK_REVERSAL]", err);
      }
    }

    return NextResponse.json(
      createSuccessResponse({
        id: updated.id,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
        paymentMethod: updated.paymentMethod,
        paymentNote: updated.paymentNote,
      })
    );
  } catch (error) {
    console.error("[POS_ORDER_PATCH]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}

/**
 * GET /api/stores/[id]/pos/orders/[orderId]
 * Get a single order with all items
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const { id: storeId, orderId } = await params;

  const session = await requireSessionApi();
  if (session instanceof NextResponse) return session;

  const storeAccess = await verifyStoreAccessWithResponse(storeId, session.user.id, request);
  if (storeAccess instanceof NextResponse) return storeAccess;
  const verification = storeAccess.store;

  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        table: { select: { label: true } },
        items: {
          include: {
            menuItem: { select: { name: true } },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    return NextResponse.json(createSuccessResponse(serializePosOrder(order)));
  } catch (error) {
    console.error("[POS_ORDER_GET]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
