import { NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { createHoldOrderSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { Prisma, type OrderType } from "@prisma/client";
import { nanoid } from "@/lib/utils/nanoid";
import { validateAndBuildOrderItems, OrderBuildError } from "@/lib/services/pos-order-builder";
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
 * If `orderId` is provided and that order is still HELD, its items/label are
 * replaced in place instead of creating a duplicate row (covers: resume, edit
 * the cart, hold again instead of paying).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await params;

  const session = await requireSessionApi();
  if (session instanceof NextResponse) return session;

  const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (verification instanceof NextResponse) return verification;
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

    let orderItems, subtotal;
    let financeSettings: Awaited<ReturnType<typeof resolveFinanceSettingsForOrder>>;
    try {
      // Independent reads (both only need storeId) — run concurrently
      // instead of two sequential round trips.
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

    // A hold has no chosen payment method yet (paymentMethod: "CASH" below is
    // an inert placeholder), so the processing fee can't be determined —
    // force it off. Tax/service charge don't depend on payment method, so
    // they're still computed for an accurate held total.
    const charges = computeOrderCharges({
      itemsTotal: subtotal,
      paymentMethod: "CASH",
      settings: { ...financeSettings, processingFeeEnabled: false },
    });

    // Re-holding an existing held order (resume -> edit -> hold again).
    if (input.orderId) {
      const existing = await prisma.order.findFirst({
        where: { id: input.orderId, storeId },
      });

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

      const updated = await prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
        return tx.order.update({
          where: { id: existing.id },
          data: {
            customerName: input.customerName ?? existing.customerName,
            orderType: input.orderType as OrderType,
            guestCount: input.orderType === "DINE_IN" ? input.guestCount : null,
            tableNumber: input.tableNumber,
            tableId: input.tableId,
            notes: input.notes,
            subtotal: new Prisma.Decimal(charges.subtotal),
            tax: new Prisma.Decimal(charges.tax),
            total: new Prisma.Decimal(charges.total),
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
      });

      return NextResponse.json(
        createSuccessResponse({ orderId: updated.id, orderNumber: updated.orderNumber })
      );
    }

    // Fresh hold.
    const orderNumber = generateOrderNumber();

    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          storeId,
          customerName: input.customerName ?? "Walk-in",
          orderType: input.orderType as OrderType,
          guestCount: input.orderType === "DINE_IN" ? input.guestCount : null,
          tableNumber: input.tableNumber,
          tableId: input.tableId,
          shiftId: input.shiftId,
          // Inert placeholder — never charged, overwritten with the real
          // choice at /finalize. HELD orders never reach payment/stock logic.
          paymentMethod: "CASH",
          paymentStatus: "PENDING",
          status: "HELD",
          source: "POS",
          notes: input.notes,
          subtotal: new Prisma.Decimal(charges.subtotal),
          tax: new Prisma.Decimal(charges.tax),
          delivery: new Prisma.Decimal(0),
          total: new Prisma.Decimal(charges.total),
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

      // Parity with normal checkout — mark the table occupied if assigned.
      if (input.tableId && input.orderType === "DINE_IN") {
        await tx.table.update({
          where: { id: input.tableId },
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
