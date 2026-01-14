import { NextResponse } from "next/server";
import { productService } from "@/lib/services/product.service";
import { bulkDeleteSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * DELETE /api/stores/[id]/products/bulk
 * Bulk delete products (hard delete)
 * Note: Related records will be cascade deleted
 */
export const DELETE = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();

    // Validate request body
    const validatedData = bulkDeleteSchema.parse(body);

    // Bulk delete products via service
    const result = await productService.bulkDeleteProducts(validatedData.ids, storeId!);

    return NextResponse.json(
      createSuccessResponse({
        message: "Products deleted successfully",
<<<<<<< HEAD
        deletedCount: result.deletedCount,
=======
        deletedCount: result.count,
>>>>>>> dev
      }),
      { status: 200 }
    );
  },
  {
    // Apply stricter rate limiting for bulk operations
    rateLimitEndpoint: "/api/stores/[id]/products/bulk",
    requireStoreAuth: true,
  }
);
