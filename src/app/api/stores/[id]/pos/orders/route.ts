import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { createPosOrderSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { Prisma, type PaymentMethod, type OrderType } from "@prisma/client";
import { nanoid } from "@/lib/utils/nanoid";
import { inngest } from "@/lib/inngest/client";

function generateOrderNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `POS-${ymd}-${nanoid(6).toUpperCase()}`;
}

/**
 * GET /api/stores/[id]/pos/orders
 * List orders for the POS queue (all sources, active statuses)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), { status: 401 });
  }

  const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (verification instanceof NextResponse) return verification;

  try {
    const orders = await prisma.order.findMany({
      where: {
        storeId,
        status: { in: ["PENDING", "CONFIRMED", "IN_PRODUCTION", "READY"] },
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

    return NextResponse.json(createSuccessResponse(orders));
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
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), { status: 401 });
  }

  const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (verification instanceof NextResponse) return verification;
  const store = verification;

  try {
    const body = await request.json();
    const parsed = createPosOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid order data", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Validate menu items belong to this store and are available
    const menuItemIds = input.items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        storefront: { storeId },
        isAvailable: true,
      },
    });

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "One or more menu items are unavailable or not found"),
        { status: 422 }
      );
    }

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    const orderItems = input.items.map((i) => {
      const menuItem = menuItemMap.get(i.menuItemId)!;
      const modifierTotal = (i.modifierSelections ?? []).reduce((sum, m) => sum + m.priceAdd, 0);
      const unitPrice = Number(menuItem.price) + modifierTotal;
      const total = unitPrice * i.quantity;
      return {
        menuItemId: i.menuItemId,
        name: menuItem.name,
        quantity: i.quantity,
        unit: "pcs",
        unitPrice,
        total,
      };
    });

    const subtotal = orderItems.reduce((s, i) => s + i.total, 0);
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
    const change = input.paymentMethod === "CASH" && input.amountTendered != null
      ? Math.max(0, input.amountTendered - subtotal)
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
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, message),
      { status: 500 }
    );
  }
}
