import { NextResponse, after } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { createPosOrderSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { Prisma, type PaymentMethod, type OrderType } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import {
  validateAndBuildOrderItems,
  resolveSettledOrderStatus,
  deliverOrderImmediately,
  draftShortfallBatchesForConfirmedOrder,
  OrderBuildError,
  type BuiltOrderItem,
} from "@/lib/services/pos-order-builder";
import { resolveFinanceSettingsForOrder } from "@/lib/services";
import { computeOrderCharges } from "@/lib/finance/order-charges";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";

/**
 * POST /api/stores/[id]/pos/orders/[orderId]/finalize
 *
 * Turns a HELD order into a real placed order — the cashier resumed it,
 * chose a payment method (and possibly edited the cart), and is now paying.
 * Mirrors POST /pos/orders (same repricing, same CASH-vs-not status/payment
 * coupling, same payment initiation + merchant notification) but operates on
 * the existing HELD row instead of creating a new one, and only fires the
 * "order placed" notification / payment initiation here — never at hold time.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const { id: storeId, orderId } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
      status: 401,
    });
  }

  const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (verification instanceof NextResponse) return verification;
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

    // Defense in depth — the client only shows "Pay Later" as a checkout
    // option when the store has enabled it, but never trust that a request
    // actually came from a client that enforced it.
    if (input.paymentMethod === "PAY_LATER" && !store.payLaterEnabled) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Pay Later is not enabled for this store"),
        { status: 422 }
      );
    }

    const existing = await prisma.order.findFirst({ where: { id: orderId, storeId } });
    if (!existing) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }
    if (existing.status !== "HELD") {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "Order is no longer held"),
        { status: 409 }
      );
    }

    let orderItems: BuiltOrderItem[];
    let subtotal: number;
    let financeSettings: Awaited<ReturnType<typeof resolveFinanceSettingsForOrder>>;
    try {
      // Independent reads (both only need storeId) — run concurrently
      // instead of two sequential round trips on the critical checkout path.
      const [built, settings] = await Promise.all([
        validateAndBuildOrderItems(storeId, input.items),
        resolveFinanceSettingsForOrder(storeId),
      ]);
      ({ orderItems, subtotal } = built);
      financeSettings = settings;
    } catch (err) {
      if (err instanceof OrderBuildError) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.INVALID_INPUT, err.message), {
          status: 422,
        });
      }
      throw err;
    }

    const charges = computeOrderCharges({
      itemsTotal: subtotal,
      discountAmount: input.discountAmount,
      paymentMethod: input.paymentMethod as PaymentMethod,
      settings: financeSettings,
    });

    // Defense in depth — the client already disables the Confirm button for
    // this case, but never trust that a request actually came from a client
    // that enforced it.
    if (
      input.paymentMethod === "CASH" &&
      input.amountTendered != null &&
      input.amountTendered < charges.total
    ) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Amount tendered is less than the order total"
        ),
        { status: 422 }
      );
    }

    const settledStatus = resolveSettledOrderStatus(
      input.paymentMethod as PaymentMethod,
      store.kitchenDisplayEnabled
    );
    const immediatelyDelivered = settledStatus === "DELIVERED";

    const order = await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: existing.id } });

      const updated = await tx.order.update({
        where: { id: existing.id },
        data: {
          customerName: input.customerName ?? existing.customerName,
          customerPhone: input.customerPhone,
          orderType: input.orderType as OrderType,
          tableNumber: input.tableNumber,
          tableId: input.tableId,
          shiftId: input.shiftId ?? existing.shiftId,
          paymentMethod: input.paymentMethod as PaymentMethod,
          paymentStatus: input.paymentMethod === "PAY_LATER" ? "PENDING" : "PAID",
          paymentNote: input.paymentNote,
          status: settledStatus,
          ...(immediatelyDelivered && { deliveredDate: new Date() }),
          notes: input.notes,
          subtotal: new Prisma.Decimal(charges.subtotal),
          tax: new Prisma.Decimal(charges.tax),
          delivery: new Prisma.Decimal(0),
          total: new Prisma.Decimal(charges.total),
          discountAmount: new Prisma.Decimal(charges.discountAmount),
          discountReason: charges.discountAmount > 0 ? input.discountReason : undefined,
          serviceCharge: new Prisma.Decimal(charges.serviceCharge),
          processingFee: new Prisma.Decimal(charges.processingFee),
          taxRate: new Prisma.Decimal(charges.taxRate),
          serviceChargeRate: new Prisma.Decimal(charges.serviceChargeRate),
          processingFeeRate: new Prisma.Decimal(charges.processingFeeRate),
          items: {
            create: orderItems.map((i) => ({
              menuItemId: i.menuItemId,
              name: i.name,
              quantity: new Prisma.Decimal(i.quantity),
              unit: i.unit,
              unitPrice: new Prisma.Decimal(i.unitPrice),
              total: new Prisma.Decimal(i.total),
              notes: i.notes,
              selectedOptions: i.selectedOptions as Prisma.InputJsonValue | undefined,
              status: i.initialStatus,
            })),
          },
        },
        include: { items: true },
      });

      // If table is assigned, mark it as OCCUPIED (parity with create) —
      // skipped when immediately delivered, same as create.
      if (input.tableId && input.orderType === "DINE_IN" && !immediatelyDelivered) {
        await tx.table.update({
          where: { id: input.tableId },
          data: { status: "OCCUPIED" },
        });
      }

      return updated;
    });

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
            customerName: input.customerName ?? "Walk-in",
            totalAmount: charges.total,
            currency: "IDR",
            paymentMethod: input.paymentMethod,
            items: orderItems.map((i) => ({ name: i.name, quantity: i.quantity })),
            merchantPhone: store.phone ?? null,
            storeName: store.name,
          },
        });
      } catch (err) {
        console.error("[POS_ORDERS_FINALIZE] Inngest event failed:", err);
      }
    });

    // Calculate change for cash payments
    const change =
      input.paymentMethod === "CASH" && input.amountTendered != null
        ? Math.max(0, input.amountTendered - charges.total)
        : null;

    return NextResponse.json(
      createSuccessResponse({
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        change,
      })
    );
  } catch (error) {
    console.error("[POS_ORDERS_FINALIZE]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(createErrorResponse(ApiErrorCode.INTERNAL_ERROR, message), {
      status: 500,
    });
  }
}
