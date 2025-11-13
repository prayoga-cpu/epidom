import { NextRequest, NextResponse } from "next/server";
import { productService } from "@/lib/services/product.service";
import { updateProductSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

/**
 * GET /api/stores/[id]/products/[productId]
 * Get a single product by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const resolvedParams = await params;
    const result = await verifyStoreAccessFromRequest(userId, { id: resolvedParams.id });

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { id: storeId, productId } = resolvedParams;

    // Get product from service
    const product = await productService.getProductById(productId);

    if (!product) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Product not found"),
        { status: 404 }
      );
    }

    // Verify product belongs to store
    if (product.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Product does not belong to this store"),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse(product), { status: 200 });
  } catch (error) {
    console.error("Error fetching product:", error);

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to fetch product"
      ),
      { status: 500 }
    );
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
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const resolvedParams = await params;
    const result = await verifyStoreAccessFromRequest(userId, { id: resolvedParams.id });

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { id: storeId, productId } = resolvedParams;
    const body = await request.json();

    // Validate request body
    const validatedData = updateProductSchema.parse(body);

    // Update product via service
    const product = await productService.updateProduct(productId, storeId, {
      sku: validatedData.sku,
      name: validatedData.name,
      description: validatedData.description,
      category: validatedData.category,
      costPrice: validatedData.costPrice ? Number(validatedData.costPrice) : undefined,
      sellingPrice: validatedData.sellingPrice ? Number(validatedData.sellingPrice) : undefined,
      currentStock: validatedData.currentStock ? Number(validatedData.currentStock) : undefined,
      unit: validatedData.unit,
      minStock: validatedData.minStock ? Number(validatedData.minStock) : undefined,
      maxStock: validatedData.maxStock ? Number(validatedData.maxStock) : undefined,
      recipeId: validatedData.recipeId,
      productionTime: validatedData.productionTime,
      shelfLife: validatedData.shelfLife,
      isActive: validatedData.isActive,
    });

    return NextResponse.json(createSuccessResponse(product), { status: 200 });
  } catch (error) {
    console.error("Error updating product:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "Invalid input data",
          error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          }))
        ),
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Handle specific business logic errors
      if (error.message.includes("does not belong")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
      if (error.message.includes("already exists")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 409 }
        );
      }
      if (error.message.includes("not found")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to update product"
      ),
      { status: 500 }
    );
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
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const resolvedParams = await params;
    const result = await verifyStoreAccessFromRequest(userId, { id: resolvedParams.id });

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { id: storeId, productId } = resolvedParams;

    // Delete product via service
    await productService.deleteProduct(productId, storeId);

    return NextResponse.json(
      createSuccessResponse({ message: "Product deleted successfully" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting product:", error);

    if (error instanceof Error) {
      if (error.message.includes("does not belong")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
      if (error.message.includes("not found")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to delete product"
      ),
      { status: 500 }
    );
  }
}
