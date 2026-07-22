import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { createPosOrderSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { Prisma, type PaymentMethod, type OrderType } from "@prisma/client";
import { nanoid } from "@/lib/utils/nanoid";
import { inngest } from "@/lib/inngest/client";
import { initiatePayment } from "@/lib/payments";
import { ACTIVE_POS_STATUSES } from "@/lib/constants/order-status";
import {
  validateAndBuildOrderItems,
  OrderBuildError,
  type BuiltOrderItem,
} from "@/lib/services/pos-order-builder";
import { serializePosOrders } from "@/lib/server/serialize";

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

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
      status: 401,
    });
  }

  const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (verification instanceof NextResponse) return verification;

  try {
    const orders = await prisma.order.findMany({
      where: {
        storeId,
        status: { in: ACTIVE_POS_STATUSES },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        table: { select: { label: true } },
        items: {
          include: {
            menuItem: { select: { name: true } },
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

    const orderNumber = generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          storeId,
          customerName: input.customerName ?? "Walk-in",
          customerPhone: input.customerPhone,
          orderType: input.orderType as OrderType,
          tableNumber: input.tableNumber,
          tableId: input.tableId,
          shiftId: input.shiftId,
          paymentMethod: input.paymentMethod as PaymentMethod,
          paymentStatus: input.paymentMethod === "CASH" ? "PAID" : "PENDING",
          status: input.paymentMethod === "CASH" ? "CONFIRMED" : "PENDING",
          source: "POS",
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
        include: {
          items: true,
          table: { select: { label: true } },
        },
      });

      // If table is assigned, mark it as OCCUPIED
      if (input.tableId && input.orderType === "DINE_IN") {
        await tx.table.update({
          where: { id: input.tableId },
          data: { status: "OCCUPIED" },
        });
      }

      return created;
    });

    // Fire background notification via Inngest (non-blocking)
    try {
      await inngest.send({
        name: "order/placed",
        data: {
          orderId: order.id,
          storeId,
          storefrontSlug: null,
          orderNumber,
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
      console.error("[POS_ORDERS_POST] Inngest event failed:", err);
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
          description: `Pesanan ${orderNumber} - POS`,
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
        console.error("[POS_ORDERS_POST] Payment initiation failed:", err);
      }
    }

    return NextResponse.json(
      createSuccessResponse({
        orderId: order.id,
        orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        change,
        qrString,
        paymentProviderRef,
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
