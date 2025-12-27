import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { productService } from "@/lib/services/product.service";
import { updateProductSchema } from "@/lib/validation/inventory.schemas";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { serializeProduct } from "@/lib/server/serialize";

/**
 * GET /api/stores/[id]/products/[productId]
 * Get a single product by ID
 */
export const GET = withApiHandler(
  async (request, { storeId, params }) => {
    const { productId } = params;

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
    return NextResponse.json(createSuccessResponse(serializeProduct(product)));
  },
  { rateLimitEndpoint: "/api/stores/[id]/products/[productId]", requireStoreAuth: true }
);

/**
 * PATCH /api/stores/[id]/products/[productId]
 * Update a product
 */
export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const { productId } = params;
    const body = await request.json();
    const validatedData = updateProductSchema.parse(body);

    // Update product via service
    const product = await productService.updateProduct(productId, storeId!, {
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
    return NextResponse.json(createSuccessResponse(serializeProduct(product)));
  },
  { rateLimitEndpoint: "/api/stores/[id]/products/[productId]", requireStoreAuth: true }
);

/**
 * DELETE /api/stores/[id]/products/[productId]
 * Delete a product (hard delete)
 * Note: Related records (OrderItem, ProductionBatch, StockMovement) will be cascade deleted
 */
export const DELETE = withApiHandler(
  async (request, { storeId, params }) => {
    const { productId } = params;

    // Delete product via service
    await productService.deleteProduct(productId, storeId!);

    return NextResponse.json(createSuccessResponse({ message: "Product deleted successfully" }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/products/[productId]", requireStoreAuth: true }
);
