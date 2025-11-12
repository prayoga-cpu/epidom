import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { subscriptionService } from "@/lib/services";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * GET /api/stores/[id]/supplier-orders/[orderId]
 * Get a specific supplier order
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check subscription plan - Supplier Management is PRO/ENTERPRISE only
    const hasAccess = await subscriptionService.hasSupplierManagementAccess(session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
          "Supplier Management is only available in Pro and Enterprise plans. Upgrade to access this feature.",
          {
            feature: "supplierManagement",
            upgradeRequired: true,
          }
        ),
        { status: 403 }
      );
    }

    const { id: storeId, orderId } = await params;

    // Verify user has access to this store
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        business: {
          userId: session.user.id,
        },
      },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const order = await prisma.supplierOrder.findFirst({
      where: {
        id: orderId,
        storeId,
      },
      include: {
        supplier: true,
        items: {
          include: {
            material: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Error fetching supplier order:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/stores/[id]/supplier-orders/[orderId]
 * Update a supplier order (status, dates, etc.)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check subscription plan - Supplier Management is PRO/ENTERPRISE only
    const hasAccess = await subscriptionService.hasSupplierManagementAccess(session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
          "Supplier Management is only available in Pro and Enterprise plans. Upgrade to access this feature.",
          {
            feature: "supplierManagement",
            upgradeRequired: true,
          }
        ),
        { status: 403 }
      );
    }

    const { id: storeId, orderId } = await params;

    // Verify user has access to this store
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        business: {
          userId: session.user.id,
        },
      },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Check if order exists
    const existingOrder = await prisma.supplierOrder.findFirst({
      where: {
        id: orderId,
        storeId,
      },
      include: {
        items: {
          include: {
            material: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const body = await request.json();
    const { status, expectedDate, receivedDate, notes } = body;

    // If changing status to RECEIVED, update material stock
    if (status === "RECEIVED" && existingOrder.status !== "RECEIVED") {
      // Use transaction to update stock and order status together
      await prisma.$transaction(async (tx) => {
        // Update material stock for each item
        for (const item of existingOrder.items) {
          const newStock = item.material.currentStock.add(item.quantity);

          await tx.material.update({
            where: { id: item.materialId },
            data: {
              currentStock: newStock,
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
        items: {
          include: {
            material: true,
          },
        },
      },
    });

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    console.error("Error updating supplier order:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/stores/[id]/supplier-orders/[orderId]
 * Delete/cancel a supplier order
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check subscription plan - Supplier Management is PRO/ENTERPRISE only
    const hasAccess = await subscriptionService.hasSupplierManagementAccess(session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
          "Supplier Management is only available in Pro and Enterprise plans. Upgrade to access this feature.",
          {
            feature: "supplierManagement",
            upgradeRequired: true,
          }
        ),
        { status: 403 }
      );
    }

    const { id: storeId, orderId } = await params;

    // Verify user has access to this store
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        business: {
          userId: session.user.id,
        },
      },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const order = await prisma.supplierOrder.findFirst({
      where: {
        id: orderId,
        storeId,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Don't allow deletion of received orders
    if (order.status === "RECEIVED") {
      return NextResponse.json({ error: "Cannot delete received orders" }, { status: 400 });
    }

    // Mark as cancelled instead of deleting
    await prisma.supplierOrder.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting supplier order:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
