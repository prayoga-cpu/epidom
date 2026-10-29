import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { createSupplierOrderSchema } from "@/lib/validation/inventory.schemas";
import { createSupplierOrder, SupplierOrderError } from "@/lib/services/supplier-order.service";

/**
 * GET /api/stores/[id]/supplier-orders
 * Get all supplier orders for a store
 */
export const GET = withApiHandler(
  async (request, { storeId, userId }) => {
    // Check subscription plan - Supplier Management is OPERATIONS/ENTERPRISE only
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
    // Check subscription plan - Supplier Management is OPERATIONS/ENTERPRISE only
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
    const input = createSupplierOrderSchema.parse(body);

    try {
      const order = await createSupplierOrder(storeId!, input);
      return NextResponse.json(createSuccessResponse({ order }), { status: 201 });
    } catch (error) {
      if (error instanceof SupplierOrderError) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, error.message), {
          status: 404,
        });
      }
      throw error;
    }
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/supplier-orders",
    requireStoreAuth: true,
  }
);
