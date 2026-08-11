import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPublicOrderSchema } from "@/lib/validation/public-orders.schemas";
import { initiatePayment } from "@/lib/payments";
import {
  resolveSettledOrderStatus,
  deliverOrderImmediately,
  draftShortfallBatchesForConfirmedOrder,
} from "@/lib/services/pos-order-builder";
import { resolveInitialOrderItemStatus } from "@/lib/services/order-status.helpers";
import { inngest } from "@/lib/inngest/client";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { Prisma, type PaymentMethod, type OrderType } from "@prisma/client";
import { nanoid } from "@/lib/utils/nanoid";
import { STRIPE_CONFIG } from "@/config/stripe.config";
import { planHasFeature } from "@/lib/plans/entitlements";
import { getFinanceSettings } from "@/lib/services";
import { computeOrderCharges } from "@/lib/finance/order-charges";

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
          include: {
            business: {
              include: {
                user: {
                  select: {
                    stripeConnectAccountId: true,
                    stripeConnectOnboarded: true,
                    subscription: { select: { plan: true, status: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!storefront || !storefront.isPublished || !storefront.acceptsOrders) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Storefront not found or not accepting orders"),
        { status: 404 }
      );
    }

    // Online ordering is a POS feature — block orders when the owner is below POS,
    // even if a stale acceptsOrders flag is still set.
    const ownerSub = storefront.store.business.user.subscription;
    const ownerPlan = ownerSub?.status === "ACTIVE" ? ownerSub.plan : "FREE";
    if (!planHasFeature(ownerPlan, "onlineOrders")) {
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
      include: {
        product: { select: { productLine: true } },
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
      const modifierTotal = (i.selectedOptions ?? []).reduce(
        (sum, m) => sum + m.priceAdjustment,
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
        notes: i.notes,
        selectedOptions: i.selectedOptions,
        initialStatus: resolveInitialOrderItemStatus(menuItem.product?.productLine),
      };
    });

    const subtotal = orderItems.reduce((s, i) => s + i.total, 0);
    const orderNumber = generateOrderNumber();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const slug = storefront.slug;

    const financeSettings = await getFinanceSettings(storefront.storeId);
    const charges = computeOrderCharges({
      itemsTotal: subtotal,
      paymentMethod: input.paymentMethod as PaymentMethod,
      settings: financeSettings,
    });

    // Mirrors the POS create route: production isn't gated on payment
    // clearing, so every method (including online gateway methods still
    // awaiting webhook confirmation) resolves to CONFIRMED/DELIVERED the
    // same way. See resolveSettledOrderStatus.
    const settledStatus = resolveSettledOrderStatus(
      input.paymentMethod as PaymentMethod,
      storefront.store.kitchenDisplayEnabled
    );
    const immediatelyDelivered = settledStatus === "DELIVERED";

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
          paymentStatus: input.paymentMethod === "CASH" ? "PAID" : "PENDING",
          status: settledStatus,
          ...(immediatelyDelivered && { deliveredDate: new Date() }),
          source: "STOREFRONT",
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
              productId: i.productId,
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
      });
      return created;
    });

    // Live-update any open dashboard/POS tab for this store (mirrors the
    // same call in the POS order route — storefront orders previously never
    // triggered this, so open dashboards only learned about them on the
    // next 30s notification-bell poll).
    publishStoreEvent(storefront.storeId, REALTIME_EVENTS.ORDER_CREATED, {
      action: "created",
      entityId: order.id,
    });

    // Initiate payment (gracefully falls back if provider not configured)
    let paymentUrl: string | null = null;
    let qrString: string | null = null;

    if (input.paymentMethod !== "CASH") {
      try {
        const user = storefront.store.business.user;
        const isStripe = input.paymentMethod === "STRIPE_CARD";
        const isConnectReady = user.stripeConnectOnboarded && user.stripeConnectAccountId;
        
        let stripeAccountId: string | undefined = undefined;
        
        if (isStripe && isConnectReady) {
          stripeAccountId = user.stripeConnectAccountId!;
        }

        const payment = await initiatePayment({
          orderId: order.id,
          amount: charges.total,
          currency: financeSettings.currency,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          description: `Pesanan ${orderNumber} - ${storefront.displayName}`,
          paymentMethod: input.paymentMethod as PaymentMethod,
          bankCode: input.bankCode as import("@/lib/payments").XenditVABankCode | undefined,
          successUrl: `${appUrl}/@${slug}/order/${order.id}?status=success`,
          cancelUrl: `${appUrl}/@${slug}/order/${order.id}?status=cancelled`,
          callbackUrl: `${appUrl}/api/webhooks/xendit`,
          stripeAccountId,
        });

        if (payment.providerRef || payment.qrString) {
          await prisma.order.update({
            where: { id: order.id },
            data: { 
              paymentProviderRef: payment.providerRef,
              paymentQrString: payment.qrString || null,
            },
          });
        }

        paymentUrl = payment.paymentUrl;
        qrString = payment.qrString ?? null;
      } catch (err) {
        console.error("[public/orders] Payment initiation failed:", err);
        // Order is still created; merchant can handle payment manually
      }
    }

    // Mirrors the POS create route exactly: DELIVERED (kitchen display off)
    // runs stock deduction now; CONFIRMED (kitchen display on) only drafts
    // shortfall batches and defers deduction to the DELIVERED transition in
    // the shared /pos/orders/[orderId] PATCH route, same as every other
    // order in that store's Active Queue / KDS — including CASH, which no
    // longer deducts immediately at checkout.
    if (immediatelyDelivered) {
      await deliverOrderImmediately(order.id, storefront.storeId);
    } else if (settledStatus === "CONFIRMED") {
      await draftShortfallBatchesForConfirmedOrder(order.id, storefront.storeId);
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
          totalAmount: charges.total,
          currency: financeSettings.currency,
          paymentMethod: input.paymentMethod,
          items: orderItems.map((i) => ({ name: i.name, quantity: i.quantity })),
          merchantPhone: store.phone ?? null,
          storeName: store.name,
        },
      });
    } catch (err) {
      console.error("[public/orders] Inngest event failed:", err);
    }

    // Merchant alert (new order) now fires from the send-order-notification
    // Inngest function above, via MagicBell — single trigger point instead
    // of a second direct push call here.

    return NextResponse.json(
      createSuccessResponse({
        orderId: order.id,
        orderNumber,
        paymentUrl,
        qrString,
        status: order.status,
        paymentStatus: order.paymentStatus,
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
