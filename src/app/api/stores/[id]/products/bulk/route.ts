import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { productService } from "@/lib/services/product.service";
import { bulkDeleteSchema } from "@/lib/validation/inventory.schemas";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { z } from "zod";

/**
 * DELETE /api/stores/[id]/products/bulk
 * Bulk delete products (hard delete)
 * Note: Related records will be cascade deleted
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const { id: storeId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    const body = await request.json();

    // Validate request body
    const validatedData = bulkDeleteSchema.parse(body);

    // Bulk delete products via service
    const result = await productService.bulkDeleteProducts(validatedData.ids, storeId);

    return NextResponse.json(
      createSuccessResponse({
        message: "Products deleted successfully",
        deletedCount: result.deletedCount
      }),
      { status: 200 }
    );
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "DELETE /api/stores/[id]/products/bulk",
      context: { storeId },
    });
  }
}
