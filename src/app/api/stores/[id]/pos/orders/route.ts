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
  skipsOnlinePayment,
  resolveSettledOrderStatus,
  deliverOrderImmediately,
  OrderBuildError,
  type BuiltOrderItem,
} from "@/lib/services/pos-order-builder";
import { serializePosOrders } from "@/lib/server/serialize";
import { resolveFinanceSettingsForOrder } from "@/lib/services";
import { computeOrderCharges } from "@/lib/finance/order-charges";

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
            menuItem: { select: { name: true, department: true } },
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

    const financeSettings = await resolveFinanceSettingsForOrder(storeId);
    const charges = computeOrderCharges({
      itemsTotal: subtotal,
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
          tableNumber: input.tableNumber,
          tableId: input.tableId,
          shiftId: input.shiftId,
          paymentMethod: input.paymentMethod as PaymentMethod,
          paymentStatus: input.paymentMethod === "CASH" ? "PAID" : "PENDING",
          status: settledStatus,
          ...(immediatelyDelivered && { deliveredDate: new Date() }),
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
              status: "PENDING",
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

    // Kitchen display is off for this store — the order skipped straight to
    // DELIVERED above, so run the side effects a normal KDS hand-off would
    // otherwise trigger later (deductStockForOrder is idempotent).
    if (immediatelyDelivered) {
      await deliverOrderImmediately(order.id, storeId);
    }

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

    // Calculate change for cash payments
    const change =
      input.paymentMethod === "CASH" && input.amountTendered != null
        ? Math.max(0, input.amountTendered - charges.total)
        : null;

    // Initiate payment for methods that actually need an online payment step
    let qrString: string | null = null;
    let paymentProviderRef: string | null = null;

    if (!skipsOnlinePayment(input.paymentMethod as PaymentMethod)) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const payment = await initiatePayment({
          orderId: order.id,
          amount: charges.total,
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
