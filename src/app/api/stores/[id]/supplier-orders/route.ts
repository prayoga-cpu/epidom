import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { subscriptionService } from "@/lib/services";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";

/**
 * GET /api/stores/[id]/supplier-orders
 * Get all supplier orders for a store
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session: Session | null = null;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
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

    const storeId = (await params).id;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

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

    return NextResponse.json(createSuccessResponse({ orders }), { status: 200 });
  } catch (error) {
    const storeId = (await params).id;
    return handleApiError(error, {
      endpoint: "GET /api/stores/[id]/supplier-orders",
      context: { storeId, userId: session?.user?.id },
    });
  }
}

/**
 * POST /api/stores/[id]/supplier-orders
 * Create a new supplier order
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session: Session | null = null;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
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

    const storeId = (await params).id;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    const body = await request.json();
    const { supplierId, items, expectedDate, notes, tax, shipping } = body;

    // Validate supplier
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        storeId,
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Order must have at least one item" }, { status: 400 });
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
          { error: `Material ${item.materialId} not found` },
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
    const storeId = (await params).id;
    return handleApiError(error, {
      endpoint: "POST /api/stores/[id]/supplier-orders",
      context: { storeId, userId: session?.user?.id },
    });
  }
}
