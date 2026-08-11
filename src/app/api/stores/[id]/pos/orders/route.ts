import { NextResponse, after } from "next/server";
import { requireSessionApi } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { createPosOrderSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { Prisma, type PaymentMethod, type OrderType } from "@prisma/client";
import { nanoid } from "@/lib/utils/nanoid";
import { inngest } from "@/lib/inngest/client";
import { ACTIVE_POS_QUEUE_FILTER } from "@/lib/constants/order-status";
import {
  validateAndBuildOrderItems,
  resolveSettledOrderStatus,
  deliverOrderImmediately,
  draftShortfallBatchesForConfirmedOrder,
  OrderBuildError,
  type BuiltOrderItem,
} from "@/lib/services/pos-order-builder";
import { serializePosOrders } from "@/lib/server/serialize";
import { resolveFinanceSettingsForOrder } from "@/lib/services";
import { computeOrderCharges } from "@/lib/finance/order-charges";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";

function generateOrderNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `POS-${ymd}-${nanoid(6).toUpperCase()}`;
}

/**
 * GET /api/stores/[id]/pos/orders
 * List orders for the POS queue (all sources, active statuses)
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await params;

  const session = await requireSessionApi();
  if (session instanceof NextResponse) return session;

  const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (verification instanceof NextResponse) return verification;
  const store = verification;

  // Active Queue is off for this store — every order settles straight to
  // DELIVERED/history (see resolveSettledOrderStatus), so there's nothing to
  // report here even if an order happens to still be unpaid.
  if (!store.kitchenDisplayEnabled) {
    return NextResponse.json(createSuccessResponse([]));
  }

  try {
    const orders = await prisma.order.findMany({
      where: {
        storeId,
        ...ACTIVE_POS_QUEUE_FILTER,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        table: { select: { label: true } },
        items: {
          include: {
            menuItem: {
              select: {
                name: true,
                department: true,
                product: { select: { productLine: true } },
              },
            },
          },
        },
        shift: {
          select: {
            staffMember: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(createSuccessResponse(serializePosOrders(orders)));
  } catch (error) {
    console.error("[POS_ORDERS_GET]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}

/**
 * POST /api/stores/[id]/pos/orders
 * Create a new order from the POS cashier (authenticated)
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await params;

  const session = await requireSessionApi();
  if (session instanceof NextResponse) return session;

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

    const orderNumber = generateOrderNumber();
    const settledStatus = resolveSettledOrderStatus(
      input.paymentMethod as PaymentMethod,
      store.kitchenDisplayEnabled
    );
    const immediatelyDelivered = settledStatus === "DELIVERED";

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          storeId,
          customerName: input.customerName ?? "Walk-in",
          customerPhone: input.customerPhone,
          orderType: input.orderType as OrderType,
          // Only DINE_IN carries a pax count — see the schema comment on
          // Order.guestCount. Takeaway stays null rather than being coerced
          // to 1, so the report can tell "no guests recorded" from "1 guest".
          guestCount: input.orderType === "DINE_IN" ? input.guestCount : null,
          tableNumber: input.tableNumber,
          tableId: input.tableId,
          shiftId: input.shiftId,
          paymentMethod: input.paymentMethod as PaymentMethod,
          paymentStatus: input.paymentMethod === "PAY_LATER" ? "PENDING" : "PAID",
          paymentNote: input.paymentNote,
          status: settledStatus,
          ...(immediatelyDelivered && { deliveredDate: new Date() }),
          source: "POS",
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
        include: {
          items: true,
          table: { select: { label: true } },
        },
      });

      // If table is assigned, mark it as OCCUPIED — skipped when the order is
      // already being delivered immediately (no dine-in service period to track).
      if (input.tableId && input.orderType === "DINE_IN" && !immediatelyDelivered) {
        await tx.table.update({
          where: { id: input.tableId },
          data: { status: "OCCUPIED" },
        });
      }

      return created;
    });

    publishStoreEvent(storeId, REALTIME_EVENTS.ORDER_CREATED, {
      action: "created",
      entityId: order.id,
    });

    // The order itself is already recorded at this point — everything below
    // is follow-up work (stock deduction, shortfall batch drafting, the
    // Inngest notification round trip), not part of recording the order, so
    // it's deferred via after() to keep it off the response's critical path.
    // after() keeps the function alive until this settles, so — unlike a bare
    // fire-and-forget promise — it's guaranteed to still run to completion
    // even though the response has already gone out.
    after(async () => {
      // Kitchen display is off for this store — the order skipped straight to
      // DELIVERED above, so run the side effects a normal KDS hand-off would
      // otherwise trigger later (deductStockForOrder is idempotent).
      if (immediatelyDelivered) {
        await deliverOrderImmediately(order.id, storeId);
      } else if (settledStatus === "CONFIRMED") {
        // Going to the kitchen/bar queue — flag any recipe-linked product
        // that's short on hand-made stock before deduction runs later.
        await draftShortfallBatchesForConfirmedOrder(order.id, storeId);
      }

      try {
        await inngest.send({
          name: "order/placed",
          data: {
            orderId: order.id,
            storeId,
            storefrontSlug: null,
            orderNumber,
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
        console.error("[POS_ORDERS_POST] Inngest event failed:", err);
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
        orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        change,
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error("[POS_ORDERS_POST]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(createErrorResponse(ApiErrorCode.INTERNAL_ERROR, message), {
      status: 500,
    });
  }
}
