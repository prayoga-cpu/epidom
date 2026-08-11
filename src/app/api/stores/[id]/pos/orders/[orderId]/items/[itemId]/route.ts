import { NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { updateOrderItemStatusSchema } from "@/lib/validation/pos.schemas";
import { productionBatchService } from "@/lib/services/production-batch.service";
import { advanceOrderToReadyIfAllItemsReady } from "@/lib/services/order-status.helpers";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";

/**
 * PATCH /api/stores/[id]/pos/orders/[orderId]/items/[itemId]
 * Update a single order item status (used by KDS)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; orderId: string; itemId: string }> }
) {
  const { id: storeId, orderId, itemId } = await params;

  const session = await requireSessionApi();
  if (session instanceof NextResponse) return session;

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

  // Items tied to an auto-drafted production batch (see
  // ProductionBatch.triggerType: ORDER_SHORTFALL) complete via the batch —
  // that's what actually happened in the kitchen — rather than a plain
  // status write, so the "kitchen made it" and "batch fulfilled" events stay
  // one action instead of two. completeProduction handles this item's status
  // (and the order auto-advance) itself.
  if (parsed.data.status === "READY" && item.productionBatchId) {
    await productionBatchService.completeProduction(
      item.productionBatchId,
      storeId,
      Number(item.quantity)
    );
    // Every other order-mutating route pushes this so the KDS and Order Queue
    // screens update instantly instead of waiting on their 10s/15s poll
    // fallback — this route was the one gap.
    publishStoreEvent(storeId, REALTIME_EVENTS.ORDER_UPDATED, {
      action: "updated",
      entityId: orderId,
    });
    return NextResponse.json(createSuccessResponse({ id: item.id, status: "READY" }));
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
    await advanceOrderToReadyIfAllItemsReady(prisma, orderId);
  }

  publishStoreEvent(storeId, REALTIME_EVENTS.ORDER_UPDATED, {
    action: "updated",
    entityId: orderId,
  });

  return NextResponse.json(createSuccessResponse({ id: updated.id, status: updated.status }));
}
