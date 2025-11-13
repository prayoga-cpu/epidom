import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

/**
 * GET /api/stores/[id]/supplier-orders
 * Get all supplier orders for a store
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();

    // Check subscription plan - Supplier Management is PRO/ENTERPRISE only
    const hasAccess = await subscriptionService.hasSupplierManagementAccess(userId);
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

    const result = await verifyStoreAccessFromRequest(userId, params);

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { store } = result;
    const storeId = store.id;

    const orders = await prisma.supplierOrder.findMany({
      where: {
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
      orderBy: {
        orderDate: "desc",
      },
    });

    return NextResponse.json(createSuccessResponse({ orders }));
  } catch (error) {
    console.error("Error fetching supplier orders:", error);
    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Internal server error"
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/stores/[id]/supplier-orders
 * Create a new supplier order
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();

    // Check subscription plan - Supplier Management is PRO/ENTERPRISE only
    const hasAccess = await subscriptionService.hasSupplierManagementAccess(userId);
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

    const result = await verifyStoreAccessFromRequest(userId, params);

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { store } = result;
    const storeId = store.id;

    const body = await request.json();
    const { supplierId, items, expectedDate, notes, tax, shipping } = body;

    // Validate supplier
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        storeId,
        isActive: true,
      },
    });

    if (!supplier) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Supplier not found"),
        { status: 404 }
      );
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "Order must have at least one item"),
        { status: 400 }
      );
    }

    // Calculate totals
    let subtotal = new Prisma.Decimal(0);
    const orderItems = [];

    for (const item of items) {
      const material = await prisma.material.findFirst({
        where: {
          id: item.materialId,
          storeId,
        },
      });

      if (!material) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, `Material ${item.materialId} not found`),
          { status: 404 }
        );
      }

      const quantity = new Prisma.Decimal(item.quantity);
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      const total = quantity.mul(unitPrice);

      subtotal = subtotal.add(total);

      orderItems.push({
        materialId: item.materialId,
        quantity,
        unit: item.unit || material.unit,
        unitPrice,
        total,
      });
    }

    const taxAmount = new Prisma.Decimal(tax || 0);
    const shippingAmount = new Prisma.Decimal(shipping || 0);
    const totalAmount = subtotal.add(taxAmount).add(shippingAmount);

    // Generate order number
    const orderCount = await prisma.supplierOrder.count({
      where: { storeId },
    });
    const orderNumber = `SO-${Date.now()}-${String(orderCount + 1).padStart(4, "0")}`;

    // Create order
    const order = await prisma.supplierOrder.create({
      data: {
        storeId,
        supplierId,
        orderNumber,
        status: "PENDING",
        orderDate: new Date(),
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        subtotal,
        tax: taxAmount,
        shipping: shippingAmount,
        total: totalAmount,
        notes: notes || null,
        items: {
          create: orderItems,
        },
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

    return NextResponse.json(createSuccessResponse({ order }), { status: 201 });
  } catch (error) {
    console.error("Error creating supplier order:", error);
    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Internal server error"
      ),
      { status: 500 }
    );
  }
}
