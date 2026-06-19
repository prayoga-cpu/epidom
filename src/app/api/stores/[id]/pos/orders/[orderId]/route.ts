import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { updateOrderStatusSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { deductStockForOrder } from "@/lib/services/stock-deduction.service";

/**
 * PATCH /api/stores/[id]/pos/orders/[orderId]
 * Update POS order status (used by order queue and KDS)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const { id: storeId, orderId } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), { status: 401 });
  }

  const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (verification instanceof NextResponse) return verification;

  try {
    const body = await request.json();
    const parsed = updateOrderStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid status", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const { status } = parsed.data;

    // Verify order belongs to this store
    const existing = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { table: true },
    });

    if (!existing) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"),
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = { status };

    // When delivering, mark timestamp and free up the table
    if (status === "DELIVERED") {
      updateData.deliveredDate = new Date();
    }

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: updateData,
      });

      // Free table when order is delivered or cancelled
      if ((status === "DELIVERED" || status === "CANCELLED") && existing.tableId) {
        await tx.table.update({
          where: { id: existing.tableId },
          data: { status: "AVAILABLE" },
        });
      }

      return order;
    });

    // Deduct ingredient stock when order is completed (Synchronous to prevent race conditions)
    if (status === "DELIVERED") {
      try {
        await deductStockForOrder(updated.id, storeId);
      } catch (err) {
        console.error("[STOCK_DEDUCTION]", err);
      }
    }

    return NextResponse.json(createSuccessResponse({ id: updated.id, status: updated.status }));
  } catch (error) {
    console.error("[POS_ORDER_PATCH]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}

/**
 * GET /api/stores/[id]/pos/orders/[orderId]
 * Get a single order with all items
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const { id: storeId, orderId } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), { status: 401 });
  }

  const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (verification instanceof NextResponse) return verification;

  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        table: { select: { label: true } },
        items: {
          include: {
            menuItem: { select: { name: true } },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse(order));
  } catch (error) {
    console.error("[POS_ORDER_GET]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
