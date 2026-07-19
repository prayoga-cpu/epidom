import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { updateOrderItemStatusSchema } from "@/lib/validation/pos.schemas";

/**
 * PATCH /api/stores/[id]/pos/orders/[orderId]/items/[itemId]
 * Update a single order item status (used by KDS)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; orderId: string; itemId: string }> }
) {
  const { id: storeId, orderId, itemId } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
      status: 401,
    });
  }

  const v = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (v instanceof NextResponse) return v;

  const body = await req.json();
  const parsed = updateOrderItemStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid status", parsed.error.flatten()),
      { status: 400 }
    );
  }

  // Verify item belongs to this order which belongs to this store
  const item = await prisma.orderItem.findFirst({
    where: { id: itemId, orderId },
    include: { order: { select: { storeId: true } } },
  });

  if (!item || item.order.storeId !== storeId) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Item not found"), {
      status: 404,
    });
  }

  const updateData: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "READY") updateData.preparedAt = new Date();
  if (parsed.data.status === "SERVED") updateData.servedAt = new Date();

  const updated = await prisma.orderItem.update({
    where: { id: itemId },
    data: updateData,
  });

  // Auto-advance order status: if ALL items ready → order READY
  if (parsed.data.status === "READY") {
    const allItems = await prisma.orderItem.findMany({
      where: { orderId },
      select: { status: true },
    });
    const allReady = allItems.every(
      (i) => i.status === "READY" || i.status === "SERVED" || i.status === "CANCELLED"
    );
    if (allReady) {
      await prisma.order.update({ where: { id: orderId }, data: { status: "READY" } });
    }
  }

  return NextResponse.json(createSuccessResponse({ id: updated.id, status: updated.status }));
}
