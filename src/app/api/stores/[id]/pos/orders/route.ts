import { NextResponse, after } from "next/server";
import { requireSessionApi } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { verifyStoreAccessWithResponse } from "@/lib/utils/store-verification";
import { createPosOrderSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { nanoid } from "@/lib/utils/nanoid";
import { inngest } from "@/lib/inngest/client";
import { ACTIVE_POS_QUEUE_FILTER } from "@/lib/constants/order-status";
import {
  deliverOrderImmediately,
  draftShortfallBatchesForConfirmedOrder,
} from "@/lib/services/pos-order-builder";
import {
  applySettlementBookkeeping,
  buildPosOrderCreatedResponse,
  buildPosSettlement,
  buildSettlementOrderData,
  mapSettlementError,
  POS_ORDER_TX_TIMEOUT_MS,
} from "@/lib/services/pos-order-settlement";
import { allocateQueueNumber } from "@/lib/services/order-queue-number";
import { resolveSaleShiftId } from "@/lib/services/shift-link";
import { serializePosOrders } from "@/lib/server/serialize";
import { decimalToNumber } from "@/types/prisma";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";

function generateOrderNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `POS-${ymd}-${nanoid(6).toUpperCase()}`;
}

/**
 * OrderPayment rows as OrderPaymentDto — Decimal → number, same reason as
 * serializePosOrder: an unconverted Prisma Decimal serializes as a STRING,
 * and the POS then silently concatenates instead of adding.
 */
function serializeOrderPayments(payments: unknown): unknown {
  if (!Array.isArray(payments)) return [];
  return payments.map((p: any) => ({
    id: p.id,
    method: p.method,
    amount: decimalToNumber(p.amount),
    amountTendered: p.amountTendered != null ? decimalToNumber(p.amountTendered) : null,
    change: p.change != null ? decimalToNumber(p.change) : null,
    note: p.note ?? null,
    refundedAmount: decimalToNumber(p.refundedAmount),
  }));
}

/**
 * GET /api/stores/[id]/pos/orders
 * List orders for the POS queue (all sources, active statuses)
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await params;

  const session = await requireSessionApi();
  if (session instanceof NextResponse) return session;

  const storeAccess = await verifyStoreAccessWithResponse(storeId, session.user.id, request);
  if (storeAccess instanceof NextResponse) return storeAccess;
  const verification = storeAccess.store;
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
        // Multi-tender rows. Readers fall back to Order.paymentMethod/total
        // when an order has none (every pre-2.88.0 order, and PAY_LATER until
        // it settles), so there is no backfill.
        payments: { orderBy: { createdAt: "asc" } },
        shift: {
          select: {
            staffMember: { select: { id: true, name: true } },
          },
        },
      },
    });

    // customerId / splitGroupId and the per-item isCustom / department ride
    // along on the row spread inside serializePosOrder; only the payment rows
    // need their own Decimal conversion.
    const serialized = serializePosOrders(orders).map((order) => ({
      ...order,
      payments: serializeOrderPayments(order.payments),
    }));

    return NextResponse.json(createSuccessResponse(serialized));
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
 *
 * Pricing, discount resolution, tenders and the Order columns all come from
 * the shared settlement helper (src/lib/services/pos-order-settlement.ts),
 * which /finalize uses too — the two used to be copies of each other.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await params;

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

    // Offline replay idempotency. Checked BEFORE any work: returning the
    // already-created order is the whole point, so a lost response or a second
    // tab flushing the same IndexedDB queue can't create a duplicate order —
    // and can't double-deduct the stock behind it. The unique index on
    // Order.clientRequestId is the real guarantee; this is the fast path that
    // turns the retry into a success instead of a 500.
    if (input.clientRequestId) {
      const existing = await prisma.order.findUnique({
        where: { clientRequestId: input.clientRequestId },
        select: { id: true, orderNumber: true, status: true, storeId: true },
      });
      if (existing && existing.storeId === storeId) {
        return NextResponse.json(
          createSuccessResponse({
            id: existing.id,
            orderNumber: existing.orderNumber,
            status: existing.status,
            deduplicated: true,
          })
        );
      }
    }

    let settlement;
    try {
      settlement = await buildPosSettlement({ storeId, store, input });
    } catch (err) {
      const mapped = mapSettlementError(err);
      if (mapped) return mapped;
      throw err;
    }

    const orderNumber = generateOrderNumber();
    const orderData = buildSettlementOrderData({ settlement, input });
    const { immediatelyDelivered, settledStatus } = settlement;

    // The client's idea of the open shift can be a minute stale on a shared till.
    const shiftId = await resolveSaleShiftId(storeId, input.shiftId);

    let transactionResult;
    try {
      transactionResult = await prisma.$transaction(
        async (tx) => {
          // Last thing before the insert: the counter row stays locked until this
          // transaction ends, and a rollback (a lost clientRequestId race, a lost
          // coupon race) hands the number back.
          const queueNumber = await allocateQueueNumber(tx, {
            storeId,
            splitGroupId: input.splitGroupId,
          });
          const created = await tx.order.create({
            data: {
              ...orderData,
              orderNumber,
              queueNumber,
              storeId,
              // Null for ordinary online checkouts; only offline replay sets it.
              // The unique index makes a concurrent double-flush fail loudly here
              // rather than silently creating a second order.
              clientRequestId: input.clientRequestId ?? null,
              shiftId,
              source: "POS",
            },
            include: {
              items: true,
              table: { select: { label: true } },
            },
          });

          // If table is assigned, mark it as OCCUPIED — skipped when the order is
          // already being delivered immediately (no dine-in service period to
          // track). updateMany so the write is store-scoped: `update` by id alone
          // would let a forged tableId flip another tenant's table.
          if (input.tableId && input.orderType === "DINE_IN" && !immediatelyDelivered) {
            await tx.table.updateMany({
              where: { id: input.tableId, storeId },
              data: { status: "OCCUPIED" },
            });
          }

          // Coupon use, points burn and the points EARN all commit with the order
          // — never in the after() block, where a rollback would leave a coupon
          // consumed by an order that does not exist.
          const bookkeeping = await applySettlementBookkeeping(tx, {
            orderId: created.id,
            storeId,
            settlement,
            currentNotes: orderData.notes,
          });

          return { order: created, pointsEarned: bookkeeping.pointsEarned };
        },
        { timeout: POS_ORDER_TX_TIMEOUT_MS }
      );
    } catch (err) {
      // A lost coupon/points race rolls the whole order back — report it as a
      // 409 rather than an opaque 500.
      const mapped = mapSettlementError(err);
      if (mapped) return mapped;
      throw err;
    }

    const { order, pointsEarned } = transactionResult;

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
        console.error("[POS_ORDERS_POST] Inngest event failed:", err);
      }
    });

    return NextResponse.json(
      createSuccessResponse(buildPosOrderCreatedResponse(order, settlement, pointsEarned)),
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
