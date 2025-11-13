import { NextRequest, NextResponse } from "next/server";
import { productService } from "@/lib/services/product.service";
import { bulkDeleteSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

/**
 * DELETE /api/stores/[id]/products/bulk
 * Bulk delete products (hard delete)
 * Note: Related records will be cascade deleted
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const result = await verifyStoreAccessFromRequest(userId, params);

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { store } = result;
    const storeId = store.id;
    const body = await request.json();

    // Validate request body
    const validatedData = bulkDeleteSchema.parse(body);

    // Bulk delete products via service
    const deleteResult = await productService.bulkDeleteProducts(validatedData.ids, storeId);

    return NextResponse.json(
      createSuccessResponse({
        message: "Products deleted successfully",
        deletedCount: deleteResult.deletedCount
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error bulk deleting products:", error);

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
      if (error.message.includes("do not belong")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to delete products"
      ),
      { status: 500 }
    );
  }
}
