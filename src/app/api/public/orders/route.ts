import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPublicOrderSchema } from "@/lib/validation/public-orders.schemas";
import { initiatePayment } from "@/lib/payments";
import { inngest } from "@/lib/inngest/client";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { Prisma, type PaymentMethod, type OrderType } from "@prisma/client";
import { nanoid } from "@/lib/utils/nanoid";

function generateOrderNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `ORD-${ymd}-${nanoid(6).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createPublicOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid order data", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Load storefront + store
    const storefront = await prisma.storefront.findUnique({
      where: { slug: input.storefrontSlug },
      include: {
        store: {
          include: { business: { select: { userId: true } } },
        },
      },
    });

    if (!storefront || !storefront.isPublished || !storefront.acceptsOrders) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Storefront not found or not accepting orders"),
        { status: 404 }
      );
    }

    // Validate all menu items belong to this storefront and are available
    const menuItemIds = input.items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        storefrontId: storefront.id,
        isAvailable: true,
      },
    });

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "One or more menu items are unavailable"),
        { status: 422 }
      );
    }

    // Calculate totals using server-side prices (client prices are advisory only)
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    const orderItems = input.items.map((i) => {
      const menuItem = menuItemMap.get(i.menuItemId)!;
      const modifierTotal = (i.modifierSelections ?? []).reduce(
        (sum, m) => sum + m.priceAdd,
        0
      );
      const unitPrice = Number(menuItem.price) + modifierTotal;
      const total = unitPrice * i.quantity;
      return {
        menuItemId: i.menuItemId,
        productId: menuItem.productId ?? undefined,
        name: menuItem.name,
        quantity: i.quantity,
        unit: "pcs",
        unitPrice,
        total,
      };
    });

    const subtotal = orderItems.reduce((s, i) => s + i.total, 0);
    const orderNumber = generateOrderNumber();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const slug = storefront.slug;

    // Create the order in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          storeId: storefront.storeId,
          storefrontId: storefront.id,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          orderType: input.orderType as OrderType,
          tableNumber: input.tableNumber,
          paymentMethod: input.paymentMethod as PaymentMethod,
          paymentStatus: "PENDING",
          source: "STOREFRONT",
          notes: input.notes,
          subtotal: new Prisma.Decimal(subtotal),
          tax: new Prisma.Decimal(0),
          delivery: new Prisma.Decimal(0),
          total: new Prisma.Decimal(subtotal),
          items: {
            create: orderItems.map((i) => ({
              menuItemId: i.menuItemId,
              productId: i.productId,
              quantity: new Prisma.Decimal(i.quantity),
              unit: i.unit,
              unitPrice: new Prisma.Decimal(i.unitPrice),
              total: new Prisma.Decimal(i.total),
            })),
          },
        },
      });
      return created;
    });

    // Initiate payment (gracefully falls back if provider not configured)
    let paymentUrl: string | null = null;
    let qrString: string | null = null;
    let finalStatus = order.status;
    let finalPaymentStatus = order.paymentStatus;

    if (input.paymentMethod !== "CASH") {
      try {
        const payment = await initiatePayment({
          orderId: order.id,
          amount: subtotal,
          currency: menuItems[0]?.currency ?? "IDR",
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          description: `Pesanan ${orderNumber} - ${storefront.displayName}`,
          paymentMethod: input.paymentMethod as PaymentMethod,
          successUrl: `${appUrl}/@${slug}/order/${order.id}?status=success`,
          cancelUrl: `${appUrl}/@${slug}/order/${order.id}?status=cancelled`,
          callbackUrl: `${appUrl}/api/webhooks/xendit`,
        });

        if (payment.providerRef) {
          await prisma.order.update({
            where: { id: order.id },
            data: { paymentProviderRef: payment.providerRef },
          });
        }

        paymentUrl = payment.paymentUrl;
        qrString = payment.qrString ?? null;
      } catch (err) {
        console.error("[public/orders] Payment initiation failed:", err);
        // Order is still created; merchant can handle payment manually
      }
    } else {
      // Cash: auto-confirm
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: "PAID", status: "CONFIRMED" },
      });
      finalStatus = "CONFIRMED";
      finalPaymentStatus = "PAID";
    }

    // Fire background notification via Inngest
    try {
      const store = storefront.store;
      await inngest.send({
        name: "order/placed",
        data: {
          orderId: order.id,
          storeId: storefront.storeId,
          storefrontSlug: slug,
          orderNumber,
          customerName: input.customerName,
          totalAmount: subtotal,
          currency: menuItems[0]?.currency ?? "IDR",
          paymentMethod: input.paymentMethod,
          items: orderItems.map((i) => ({ name: i.name, quantity: i.quantity })),
          merchantPhone: store.phone ?? null,
          storeName: store.name,
        },
      });
    } catch (err) {
      console.error("[public/orders] Inngest event failed:", err);
    }

    return NextResponse.json(
      createSuccessResponse({
        orderId: order.id,
        orderNumber,
        paymentUrl,
        qrString,
        status: finalStatus,
        paymentStatus: finalPaymentStatus,
      }),
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("[PUBLIC_ORDERS_POST_ERROR]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, message),
      { status: 500 }
    );
  }
}
