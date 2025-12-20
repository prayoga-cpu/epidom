import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { productService } from "@/lib/services/product.service";
import { updateProductSchema } from "@/lib/validation/inventory.schemas";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { serializeProduct } from "@/lib/server/serialize";
import { z } from "zod";

/**
 * GET /api/stores/[id]/products/[productId]
 * Get a single product by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    const { id: storeId, productId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    // Get product from service
    const product = await productService.getProductById(productId);

    if (!product) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.PRODUCT_NOT_FOUND, "Product not found"),
        { status: 404 }
      );
    }

    // Verify product belongs to store
    if (product.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.FORBIDDEN, "Product does not belong to this store"),
        { status: 403 }
      );
    }

    // Serialize Decimal fields to numbers for Client Components
    return NextResponse.json(createSuccessResponse(serializeProduct(product)), { status: 200 });
  } catch (error) {
    const { id: storeId, productId } = await params;
    return handleApiError(error, {
      endpoint: "GET /api/stores/[id]/products/[productId]",
      context: { storeId, productId },
    });
  }
}

/**
 * PATCH /api/stores/[id]/products/[productId]
 * Update a product
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    const { id: storeId, productId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    const body = await request.json();

    // Validate request body
    const validatedData = updateProductSchema.parse(body);

    // Update product via service
    const product = await productService.updateProduct(productId, storeId, {
      sku: validatedData.sku,
      name: validatedData.name,
      description: validatedData.description,
      category: validatedData.category,
      costPrice:
        validatedData.costPrice !== undefined ? Number(validatedData.costPrice) : undefined,
      sellingPrice:
        validatedData.sellingPrice !== undefined ? Number(validatedData.sellingPrice) : undefined,
      currentStock:
        validatedData.currentStock !== undefined ? Number(validatedData.currentStock) : undefined,
      unit: validatedData.unit,
      minStock: validatedData.minStock !== undefined ? Number(validatedData.minStock) : undefined,
      maxStock: validatedData.maxStock !== undefined ? Number(validatedData.maxStock) : undefined,
      recipeIds: validatedData.recipeIds,
      productionTime: validatedData.productionTime,
      shelfLife: validatedData.shelfLife,
    });

    // Serialize Decimal fields to numbers for Client Components
    return NextResponse.json(createSuccessResponse(serializeProduct(product)), { status: 200 });
  } catch (error) {
    const { id: storeId, productId } = await params;
    return handleApiError(error, {
      endpoint: "PATCH /api/stores/[id]/products/[productId]",
      context: { storeId, productId },
    });
  }
}

/**
 * DELETE /api/stores/[id]/products/[productId]
 * Delete a product (hard delete)
 * Note: Related records (OrderItem, ProductionBatch, StockMovement) will be cascade deleted
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    const { id: storeId, productId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    // Delete product via service
    await productService.deleteProduct(productId, storeId);

    return NextResponse.json(createSuccessResponse({ message: "Product deleted successfully" }), {
      status: 200,
    });
  } catch (error) {
    const { id: storeId, productId } = await params;
    return handleApiError(error, {
      endpoint: "DELETE /api/stores/[id]/products/[productId]",
      context: { storeId, productId },
    });
  }
}
