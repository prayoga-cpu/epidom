import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { subscriptionService } from "@/lib/services";
import { publishStockChanged } from "@/lib/realtime/publish";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { updateSupplierOrderSchema } from "@/lib/validation/inventory.schemas";

/**
 * GET /api/stores/[id]/supplier-orders/[orderId]
 * Get a specific supplier order
 */
export const GET = withApiHandler(
  async (request, { storeId, params, userId }) => {
    const { orderId } = params;

    // Check subscription plan - Supplier Management is OPERATIONS/ENTERPRISE only
    const hasAccess = await subscriptionService.hasSupplierManagementAccess(userId);
    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
          "Supplier Management is only available in Pro and Enterprise plans. Upgrade to access this feature.",
          { feature: "supplierManagement", upgradeRequired: true }
        ),
        { status: 403 }
      );
    }

    const order = await prisma.supplierOrder.findFirst({
      where: { id: orderId, storeId },
      include: {
        supplier: true,
        items: { include: { material: true } },
      },
    });

    if (!order) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    return NextResponse.json(createSuccessResponse({ order }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/supplier-orders/[orderId]", requireStoreAuth: true }
);

/**
 * PATCH /api/stores/[id]/supplier-orders/[orderId]
 * Update a supplier order (status, dates, etc.)
 */
export const PATCH = withApiHandler(
  async (request, { storeId, params, userId }) => {
    const { orderId } = params;

    // Check subscription plan - Supplier Management is OPERATIONS/ENTERPRISE only
    const hasAccess = await subscriptionService.hasSupplierManagementAccess(userId);
    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
          "Supplier Management is only available in Pro and Enterprise plans. Upgrade to access this feature.",
          { feature: "supplierManagement", upgradeRequired: true }
        ),
        { status: 403 }
      );
    }

    // Check if order exists
    const existingOrder = await prisma.supplierOrder.findFirst({
      where: { id: orderId, storeId },
      include: { items: { include: { material: true } } },
    });

    if (!existingOrder) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    const body = await request.json();
    const { status, expectedDate, receivedDate, notes } = updateSupplierOrderSchema.parse(body);

    // If changing status to RECEIVED, update material stock
    if (status === "RECEIVED" && existingOrder.status !== "RECEIVED") {
      // Use transaction to update stock and order status together
      const receivedAt = new Date();

      await prisma.$transaction(async (tx) => {
        // Update material stock for each item
        for (const item of existingOrder.items) {
          const newStock = item.material.currentStock.add(item.quantity);

          // Carry the DLC agreed on the order line onto the material, so
          // receiving a delivery is the only place the merchant has to type
          // it. Material.expirationDate holds a single next-expiry date (not
          // one per lot), so among dates still in the future the soonest wins
          // — a batch expiring sooner must not be masked by a later one.
          //
          // The already-passed case has to be handled separately: nothing
          // clears this field when stock is consumed, so a material routinely
          // sits on an expired date from a lot that is long gone. A plain
          // "soonest wins" would reject every incoming DLC there (any future
          // date loses to a past one) and pin the material as expired
          // forever, with the Stock page still listing freshly delivered
          // goods under its "expired" filter.
          const currentExpiry = item.material.expirationDate;
          const shouldTakeExpiry =
            !!item.expiryDate &&
            (!currentExpiry || currentExpiry < receivedAt || item.expiryDate < currentExpiry);

          await tx.material.update({
            where: { id: item.materialId },
            data: {
              currentStock: newStock,
              ...(shouldTakeExpiry && { expirationDate: item.expiryDate }),
            },
          });

          // Create stock movement record
          await tx.stockMovement.create({
            data: {
              materialId: item.materialId,
              type: "PURCHASE",
              quantity: item.quantity,
              unit: item.unit,
              balanceAfter: newStock,
              notes: `Supplier order ${existingOrder.orderNumber} received`,
            },
          });
        }

        // Update order
        await tx.supplierOrder.update({
          where: { id: orderId },
          data: {
            status,
            expectedDate: expectedDate ? new Date(expectedDate) : undefined,
            receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
            notes: notes !== undefined ? notes : undefined,
          },
        });
      });

      // Receiving a delivery is the single most common way stock goes UP, and
      // it moved every material on the order — tell the other open views to
      // refetch. Published after the transaction resolves, never inside it, so
      // a rollback can't announce a restock that never happened.
      // storeId is non-null here: `requireStoreAuth: true` throws before the
      // handler runs when it can't be resolved (see api-handler.ts), it just
      // isn't narrowed in the context type.
      publishStockChanged(storeId!, {
        materialIds: existingOrder.items.map((item) => item.materialId),
      });
    } else {
      // Just update the order without stock changes
      await prisma.supplierOrder.update({
        where: { id: orderId },
        data: {
          status: status || undefined,
          expectedDate: expectedDate ? new Date(expectedDate) : undefined,
          receivedDate: receivedDate ? new Date(receivedDate) : undefined,
          notes: notes !== undefined ? notes : undefined,
        },
      });
    }

    // Fetch updated order
    const updatedOrder = await prisma.supplierOrder.findUnique({
      where: { id: orderId },
      include: {
        supplier: true,
        items: { include: { material: true } },
      },
    });

    return NextResponse.json(createSuccessResponse({ order: updatedOrder }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/supplier-orders/[orderId]", requireStoreAuth: true }
);

/**
 * DELETE /api/stores/[id]/supplier-orders/[orderId]
 * Delete/cancel a supplier order
 */
export const DELETE = withApiHandler(
  async (request, { storeId, params, userId }) => {
    const { orderId } = params;

    // Check subscription plan - Supplier Management is OPERATIONS/ENTERPRISE only
    const hasAccess = await subscriptionService.hasSupplierManagementAccess(userId);
    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
          "Supplier Management is only available in Pro and Enterprise plans. Upgrade to access this feature.",
          { feature: "supplierManagement", upgradeRequired: true }
        ),
        { status: 403 }
      );
    }

    const order = await prisma.supplierOrder.findFirst({
      where: { id: orderId, storeId },
    });

    if (!order) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    // Don't allow deletion of received orders
    if (order.status === "RECEIVED") {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_LOGIC_ERROR, "Cannot delete received orders"),
        { status: 400 }
      );
    }

    // Mark as cancelled instead of deleting
    await prisma.supplierOrder.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json(createSuccessResponse({ success: true }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/supplier-orders/[orderId]", requireStoreAuth: true }
);
