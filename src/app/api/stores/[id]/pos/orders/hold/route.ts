import { NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { verifyStoreAccessWithResponse } from "@/lib/utils/store-verification";
import { createHoldOrderSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { Prisma, type OrderType } from "@prisma/client";
import { nanoid } from "@/lib/utils/nanoid";
import { validateAndBuildOrderItems } from "@/lib/services/pos-order-builder";
import {
  buildOrderItemCreateData,
  mapSettlementError,
  SettlementError,
} from "@/lib/services/pos-order-settlement";
import { claimOrderTransition } from "@/lib/services/order-status.helpers";
import { allocateQueueNumber } from "@/lib/services/order-queue-number";
import { resolveSaleShiftId } from "@/lib/services/shift-link";
import { resolveOrderDiscount } from "@/lib/services/pos-discount.service";
import { resolveFinanceSettingsForOrder } from "@/lib/services";
import { computeOrderCharges } from "@/lib/finance/order-charges";

function generateOrderNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `POS-${ymd}-${nanoid(6).toUpperCase()}`;
}

/**
 * POST /api/stores/[id]/pos/orders/hold
 *
 * Park the current cart aside as a HELD order — visible in the Active Queue
 * and Order History, but never in KDS or revenue/analytics (see
 * ACTIVE_POS_STATUSES / NON_REVENUE_STATUSES in src/lib/constants/order-status.ts).
 * No payment method yet, no stock deduction, no payment initiation, no
 * customer/merchant notification — a hold, by definition, hasn't been placed.
 *
 * It DOES persist the attached customer and the manual/preset discount, so
 * "Save Bill" → resume gives the cashier back the bill they parked. Coupons
 * and loyalty points are deliberately not accepted here: both consume
 * something (a coupon use, a points balance) and parking a bill must not.
 *
 * If `orderId` is provided and that order is still HELD, its items/label are
 * replaced in place instead of creating a duplicate row (covers: resume, edit
 * the cart, hold again instead of paying).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await params;

  const session = await requireSessionApi();
  if (session instanceof NextResponse) return session;

  const storeAccess = await verifyStoreAccessWithResponse(storeId, session.user.id, request);
  if (storeAccess instanceof NextResponse) return storeAccess;
  const verification = storeAccess.store;
  const store = verification;

  // Defense in depth — the client only shows the Hold button when the store's
  // Active Queue is on, but never trust that a request actually came from a
  // client that enforced it. A HELD order only makes sense with a queue to
  // park it in and a board to resume it from; with the queue off, every
  // order settles straight to DELIVERED/history instead (see
  // resolveSettledOrderStatus).
  if (!store.kitchenDisplayEnabled) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INVALID_INPUT, "Active Queue is off for this store"),
      { status: 422 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createHoldOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Invalid hold data",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Re-holding an existing held order (resume -> edit -> hold again). Loaded
    // up front because the discount and the attached customer fall back to
    // what that row already carries when the body omits them.
    let existing: Awaited<ReturnType<typeof prisma.order.findFirst>> = null;
    if (input.orderId) {
      existing = await prisma.order.findFirst({ where: { id: input.orderId, storeId } });

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
    }

    let orderItems, subtotal;
    let financeSettings: Awaited<ReturnType<typeof resolveFinanceSettingsForOrder>>;
    let discount: { discountAmount: number; discountReason?: string };
    let customer: { id: string; name: string; phone: string | null; email: string | null } | null =
      null;
    try {
      // Independent reads (both only need storeId) — run concurrently
      // instead of two sequential round trips.
      const [built, settings] = await Promise.all([
        validateAndBuildOrderItems(storeId, input.items),
        resolveFinanceSettingsForOrder(storeId),
      ]);
      ({ orderItems, subtotal } = built);
      financeSettings = settings;

      if (input.customerId) {
        customer = await prisma.customer.findFirst({
          where: { id: input.customerId, storeId },
          select: { id: true, name: true, phone: true, email: true },
        });
        if (!customer) {
          return NextResponse.json(
            createErrorResponse(ApiErrorCode.INVALID_INPUT, "Customer not found"),
            { status: 422 }
          );
        }
      }

      // A re-hold that says nothing about the discount KEEPS the one the bill
      // already carries. The client re-saves a bill after editing the cart and
      // has no reason to resend a discount it never touched; recomputing from
      // an empty body would silently wipe it — the same asymmetry that governs
      // customerId. Sending any of the three fields (including `presetId:
      // null`) re-derives it from scratch.
      const discountOmitted =
        input.discountAmount === undefined &&
        input.discountReason === undefined &&
        input.presetId === undefined;

      if (existing && discountOmitted) {
        discount = {
          discountAmount: Number(existing.discountAmount),
          discountReason: existing.discountReason ?? undefined,
        };
      } else {
        // Preset amounts are priced server-side exactly as at checkout, so the
        // held total is the one the cashier will actually charge. A hold is
        // always an online action, so there is nothing to be tolerant about.
        discount = await resolveOrderDiscount({
          storeId,
          itemsTotal: subtotal,
          discountAmount: input.discountAmount,
          discountReason: input.discountReason,
          presetId: input.presetId ?? undefined,
          tolerant: false,
        });
      }
    } catch (err) {
      const mapped = mapSettlementError(err);
      if (mapped) return mapped;
      throw err;
    }

    // A hold has no chosen payment method yet (paymentMethod: "CASH" below is
    // an inert placeholder), so the processing fee can't be determined —
    // force it off. Tax/service charge don't depend on payment method, so
    // they're still computed for an accurate held total.
    const charges = computeOrderCharges({
      itemsTotal: subtotal,
      discountAmount: discount.discountAmount,
      paymentMethod: "CASH",
      settings: { ...financeSettings, processingFeeEnabled: false },
    });

    // Columns shared by the re-hold (update) and fresh-hold (create) paths.
    const heldOrderData = {
      customerPhone: customer?.phone ?? input.customerPhone,
      ...(customer?.email ? { customerEmail: customer.email } : {}),
      // Three-state, matching finalize: a resolved customer wins, an explicit
      // `null` detaches, and an omitted field keeps whatever the held row had.
      // Dropping it silently would cost the customer their points at checkout.
      customerId:
        customer?.id ?? (input.customerId === null ? null : (existing?.customerId ?? null)),
      orderType: input.orderType as OrderType,
      guestCount: input.orderType === "DINE_IN" ? input.guestCount : null,
      tableNumber: input.tableNumber,
      tableId: input.tableId,
      notes: input.notes,
      subtotal: new Prisma.Decimal(charges.subtotal),
      tax: new Prisma.Decimal(charges.tax),
      total: new Prisma.Decimal(charges.total),
      discountAmount: new Prisma.Decimal(charges.discountAmount),
      // `null`, never `undefined`: on the re-hold UPDATE path `undefined` is a
      // Prisma no-op, which left a stale reason next to a cleared discount.
      discountReason: charges.discountAmount > 0 ? (discount.discountReason ?? null) : null,
      serviceCharge: new Prisma.Decimal(charges.serviceCharge),
      processingFee: new Prisma.Decimal(charges.processingFee),
      taxRate: new Prisma.Decimal(charges.taxRate),
      serviceChargeRate: new Prisma.Decimal(charges.serviceChargeRate),
      processingFeeRate: new Prisma.Decimal(charges.processingFeeRate),
      items: { create: buildOrderItemCreateData(orderItems) },
    };

    // Re-holding an existing held order (resume -> edit -> hold again).
    if (existing) {
      const heldOrderId = existing.id;
      const previousCustomerName = existing.customerName;

      let updated;
      try {
        updated = await prisma.$transaction(async (tx) => {
          // Claim it: a bill that another till finalized between the check
          // above and here must not be rewritten back into a HELD cart, which
          // would resurrect a paid order as an unpaid one.
          const stillHeld = await claimOrderTransition(tx, {
            orderId: heldOrderId,
            storeId,
            guard: { status: "HELD" },
            data: { status: "HELD" },
          });
          if (!stillHeld) {
            throw new SettlementError("Order is no longer held", 409, ApiErrorCode.CONFLICT);
          }

          await tx.orderItem.deleteMany({ where: { orderId: heldOrderId } });
          return tx.order.update({
            where: { id: heldOrderId },
            data: {
              ...heldOrderData,
              customerName: customer?.name ?? input.customerName ?? previousCustomerName,
            },
            include: { items: true },
          });
        });
      } catch (err) {
        const mapped = mapSettlementError(err);
        if (mapped) return mapped;
        throw err;
      }

      return NextResponse.json(
        createSuccessResponse({ orderId: updated.id, orderNumber: updated.orderNumber })
      );
    }

    // Fresh hold.
    const orderNumber = generateOrderNumber();
    // The client's idea of the open shift can be a minute stale on a shared till.
    const shiftId = await resolveSaleShiftId(storeId, input.shiftId);

    const created = await prisma.$transaction(async (tx) => {
      // A hold is born with its call-out number; /finalize later updates this
      // same row, so the number the cashier read out at the hold stays valid.
      const queueNumber = await allocateQueueNumber(tx, { storeId });
      const order = await tx.order.create({
        data: {
          ...heldOrderData,
          orderNumber,
          queueNumber,
          storeId,
          customerName: customer?.name ?? input.customerName ?? "Walk-in",
          shiftId,
          // Inert placeholder — never charged, overwritten with the real
          // choice at /finalize. HELD orders never reach payment/stock logic.
          paymentMethod: "CASH",
          paymentStatus: "PENDING",
          status: "HELD",
          source: "POS",
          delivery: new Prisma.Decimal(0),
        },
        include: { items: true },
      });

      // Parity with normal checkout — mark the table occupied if assigned.
      // updateMany so the write is store-scoped: `update` by id alone would
      // let a forged tableId flip another tenant's table.
      if (input.tableId && input.orderType === "DINE_IN") {
        await tx.table.updateMany({
          where: { id: input.tableId, storeId },
          data: { status: "OCCUPIED" },
        });
      }

      return order;
    });

    return NextResponse.json(
      createSuccessResponse({ orderId: created.id, orderNumber: created.orderNumber }),
      { status: 201 }
    );
  } catch (error) {
    console.error("[POS_ORDERS_HOLD_POST]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(createErrorResponse(ApiErrorCode.INTERNAL_ERROR, message), {
      status: 500,
    });
  }
}
