import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { subscriptionService } from "@/lib/services";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { updateSupplierOrderSchema } from "@/lib/validation/inventory.schemas";
import { cancelSupplierOrder, receiveSupplierOrder } from "@/lib/services/supplier-order.service";

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
      const claimed = await receiveSupplierOrder(storeId!, existingOrder, {
        expectedDate,
        receivedDate,
        notes,
      });
      if (!claimed) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.CONFLICT, "This order was already received"),
          { status: 409 }
        );
      }
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

    const outcome = await cancelSupplierOrder(storeId!, orderId);
    if (outcome === "not_found") {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    // Don't allow deletion of received orders (cancelled, never deleted)
    if (outcome === "received") {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_LOGIC_ERROR, "Cannot delete received orders"),
        { status: 400 }
      );
    }

    return NextResponse.json(createSuccessResponse({ success: true }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/supplier-orders/[orderId]", requireStoreAuth: true }
);
