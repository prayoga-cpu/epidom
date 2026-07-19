import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { createPosOrderSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { Prisma, type PaymentMethod, type OrderType } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import { initiatePayment } from "@/lib/payments";
import {
  validateAndBuildOrderItems,
  OrderBuildError,
  type BuiltOrderItem,
} from "@/lib/services/pos-order-builder";

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
    try {
      ({ orderItems, subtotal } = await validateAndBuildOrderItems(storeId, input.items));
    } catch (err) {
      if (err instanceof OrderBuildError) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.INVALID_INPUT, err.message), {
          status: 422,
        });
      }
      throw err;
    }

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
          paymentStatus: input.paymentMethod === "CASH" ? "PAID" : "PENDING",
          status: input.paymentMethod === "CASH" ? "CONFIRMED" : "PENDING",
          notes: input.notes,
          subtotal: new Prisma.Decimal(subtotal),
          tax: new Prisma.Decimal(0),
          delivery: new Prisma.Decimal(0),
          total: new Prisma.Decimal(subtotal),
          items: {
            create: orderItems.map((i) => ({
              menuItemId: i.menuItemId,
              name: i.name,
              quantity: new Prisma.Decimal(i.quantity),
              unit: i.unit,
              unitPrice: new Prisma.Decimal(i.unitPrice),
              total: new Prisma.Decimal(i.total),
              status: "PENDING",
            })),
          },
        },
        include: { items: true },
      });

      // If table is assigned, mark it as OCCUPIED (parity with create).
      if (input.tableId && input.orderType === "DINE_IN") {
        await tx.table.update({
          where: { id: input.tableId },
          data: { status: "OCCUPIED" },
        });
      }

      return updated;
    });

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
          totalAmount: subtotal,
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

    // Calculate change for cash payments
    const change =
      input.paymentMethod === "CASH" && input.amountTendered != null
        ? Math.max(0, input.amountTendered - subtotal)
        : null;

    // Initiate payment for non-CASH methods
    let qrString: string | null = null;
    let paymentProviderRef: string | null = null;

    if (input.paymentMethod !== "CASH") {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const payment = await initiatePayment({
          orderId: order.id,
          amount: subtotal,
          currency: "IDR",
          customerName: input.customerName ?? "Walk-in",
          customerPhone: input.customerPhone,
          description: `Pesanan ${order.orderNumber} - POS`,
          paymentMethod: input.paymentMethod as PaymentMethod,
          bankCode: input.bankCode as import("@/lib/payments").XenditVABankCode | undefined,
          successUrl: `${appUrl}/pos`, // POS doesn't redirect
          cancelUrl: `${appUrl}/pos`,
          callbackUrl: `${appUrl}/api/webhooks/xendit`,
        });

        if (payment.providerRef || payment.qrString) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentProviderRef: payment.providerRef,
              paymentQrString: payment.qrString || null,
            },
          });
          qrString = payment.qrString ?? null;
          paymentProviderRef = payment.providerRef ?? null;
        }
      } catch (err) {
        console.error("[POS_ORDERS_FINALIZE] Payment initiation failed:", err);
      }
    }

    return NextResponse.json(
      createSuccessResponse({
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        change,
        qrString,
        paymentProviderRef,
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
