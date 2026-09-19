import { NextResponse, after } from "next/server";
import { requireSessionApi } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { verifyStoreAccessWithResponse } from "@/lib/utils/store-verification";
import { createPosOrderSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { inngest } from "@/lib/inngest/client";
import {
  deliverOrderImmediately,
  draftShortfallBatchesForConfirmedOrder,
} from "@/lib/services/pos-order-builder";
import {
  applySettlementBookkeeping,
  buildPosOrderCreatedResponse,
  buildPosSettlement,
  buildSettlementOrderData,
  claimHeldOrderForSettlement,
  mapSettlementError,
  POS_ORDER_TX_TIMEOUT_MS,
} from "@/lib/services/pos-order-settlement";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";

/**
 * POST /api/stores/[id]/pos/orders/[orderId]/finalize
 *
 * Turns a HELD order into a real placed order — the cashier resumed it,
 * chose a payment method (and possibly edited the cart), and is now paying.
 * Mirrors POST /pos/orders (same repricing, same discount/tender resolution,
 * same payment initiation + merchant notification — all of it now literally
 * the same code, via pos-order-settlement.ts) but operates on the existing
 * HELD row instead of creating a new one, and only fires the "order placed"
 * notification / payment initiation here — never at hold time.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const { id: storeId, orderId } = await params;

  const session = await requireSessionApi();
  if (session instanceof NextResponse) return session;

  const storeAccess = await verifyStoreAccessWithResponse(storeId, session.user.id, request);
  if (storeAccess instanceof NextResponse) return storeAccess;
  const verification = storeAccess.store;
  const store = verification;

  try {
    const body = await request.json();
    const parsed = createPosOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Invalid order data",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    const input = parsed.data;

    const existing = await prisma.order.findFirst({ where: { id: orderId, storeId } });
    if (!existing) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }
    // Fast 409 for the common case. NOT the race guard — two tills finalizing
    // the same saved bill both pass this. claimHeldOrderForSettlement inside
    // the transaction is what actually serializes them.
    if (existing.status !== "HELD") {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "Order is no longer held"),
        { status: 409 }
      );
    }

    let settlement;
    try {
      settlement = await buildPosSettlement({ storeId, store, input });
    } catch (err) {
      const mapped = mapSettlementError(err);
      if (mapped) return mapped;
      throw err;
    }

    const orderData = buildSettlementOrderData({
      settlement,
      input,
      // The checkout dialog only sends customerName/guestCount when it has
      // them, so finalizing must not wipe what the hold already captured.
      fallbackCustomerName: existing.customerName,
      existingGuestCount: existing.guestCount,
      existingCustomerId: existing.customerId,
    });
    const { immediatelyDelivered, settledStatus } = settlement;

    let transactionResult;
    try {
      transactionResult = await prisma.$transaction(
        async (tx) => {
          // FIRST statement: take the bill. Everything below — including the
          // coupon use and the points burn — is conditional on having won.
          await claimHeldOrderForSettlement(tx, {
            orderId: existing.id,
            storeId,
            settledStatus,
          });

          await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
          // A hold never writes tenders, but clear them anyway so this stays a
          // true replace rather than an append if the row ever has any.
          await tx.orderPayment.deleteMany({ where: { orderId: existing.id } });

          const updated = await tx.order.update({
            where: { id: existing.id },
            data: {
              ...orderData,
              shiftId: input.shiftId ?? existing.shiftId,
            },
            include: { items: true },
          });

          // If table is assigned, mark it as OCCUPIED (parity with create) —
          // skipped when immediately delivered, same as create. updateMany so
          // the write is store-scoped: `update` by id alone would let a
          // forged tableId flip another tenant's table.
          if (input.tableId && input.orderType === "DINE_IN" && !immediatelyDelivered) {
            await tx.table.updateMany({
              where: { id: input.tableId, storeId },
              data: { status: "OCCUPIED" },
            });
          }

          const bookkeeping = await applySettlementBookkeeping(tx, {
            orderId: updated.id,
            storeId,
            settlement,
            currentNotes: orderData.notes,
          });

          return { order: updated, pointsEarned: bookkeeping.pointsEarned };
        },
        { timeout: POS_ORDER_TX_TIMEOUT_MS }
      );
    } catch (err) {
      // A lost claim (409) or a lost coupon/points race surfaces here, after
      // the whole transaction has rolled back — nothing was consumed.
      const mapped = mapSettlementError(err);
      if (mapped) return mapped;
      throw err;
    }

    const { order, pointsEarned } = transactionResult;

    publishStoreEvent(storeId, REALTIME_EVENTS.ORDER_UPDATED, {
      action: "updated",
      entityId: order.id,
    });

    // The order itself is already recorded at this point — everything below
    // is follow-up work, deferred via after() to keep it off the response's
    // critical path (see pos/orders/route.ts POST for the same pattern).
    after(async () => {
      if (immediatelyDelivered) {
        await deliverOrderImmediately(order.id, storeId);
      } else if (settledStatus === "CONFIRMED") {
        await draftShortfallBatchesForConfirmedOrder(order.id, storeId);
      }

      // Fire background notification via Inngest — the true, one-time
      // placement moment for this order (never fired at hold time).
      try {
        await inngest.send({
          name: "order/placed",
          data: {
            orderId: order.id,
            storeId,
            storefrontSlug: null,
            orderNumber: order.orderNumber,
            customerName: settlement.customerName,
            totalAmount: settlement.charges.total,
            currency: "IDR",
            paymentMethod: settlement.paymentMethod,
            items: settlement.orderItems.map((i) => ({ name: i.name, quantity: i.quantity })),
            merchantPhone: store.phone ?? null,
            storeName: store.name,
          },
        });
      } catch (err) {
        console.error("[POS_ORDERS_FINALIZE] Inngest event failed:", err);
      }
    });

    return NextResponse.json(
      createSuccessResponse(buildPosOrderCreatedResponse(order, settlement, pointsEarned))
    );
  } catch (error) {
    console.error("[POS_ORDERS_FINALIZE]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(createErrorResponse(ApiErrorCode.INTERNAL_ERROR, message), {
      status: 500,
    });
  }
}
