import { NextResponse } from "next/server";
import { materialService } from "@/lib/services/material.service";
import { bulkDeleteSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * DELETE /api/stores/[id]/materials/bulk
 *
 * Bulk delete materials.
 * Request body: { ids: string[] }
 */
export const DELETE = withApiHandler(
  async (request, { storeId }) => {
    // Parse and validate request body
    const body = await request.json();
    const { ids } = bulkDeleteSchema.parse(body);

    // Bulk delete materials via service
<<<<<<< HEAD
    const deletedCount = await materialService.bulkDeleteMaterials(ids, storeId!);
=======
    const { count: deletedCount } = await materialService.bulkDeleteMaterials(ids, storeId!);
>>>>>>> dev

    return NextResponse.json(
      createSuccessResponse({
        message: `Successfully deleted ${deletedCount} material(s)`,
        deletedCount,
      })
    );
  },
  {
    // Apply stricter rate limiting for bulk operations
    rateLimitEndpoint: "/api/stores/[id]/materials/bulk",
    requireStoreAuth: true,
  }
);
