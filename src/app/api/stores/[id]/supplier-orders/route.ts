import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { createSupplierOrderSchema } from "@/lib/validation/inventory.schemas";

/**
 * GET /api/stores/[id]/supplier-orders
 * Get all supplier orders for a store
 */
export const GET = withApiHandler(
  async (request, { storeId, userId }) => {
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
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/supplier-orders",
    requireStoreAuth: true,
  }
);

/**
 * POST /api/stores/[id]/supplier-orders
 * Create a new supplier order
 */
export const POST = withApiHandler(
  async (request, { storeId, userId }) => {
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

    const body = await request.json();

    // Validate request body with Zod
    const { supplierId, items, expectedDate, notes, tax, shipping } =
      createSupplierOrderSchema.parse(body);

    // Validate supplier existence (Business Logic)
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        storeId,
      },
    });

    if (!supplier) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.NOT_FOUND,
          "Supplier not found or does not belong to this store"
        ),
        { status: 404 }
      );
    }

    // Calculate totals and prepare items
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

    // Create order transactionally
    const order = await prisma.supplierOrder.create({
      data: {
        storeId: storeId!,
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
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/supplier-orders",
    requireStoreAuth: true,
  }
);
