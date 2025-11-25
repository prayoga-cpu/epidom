import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { materialService } from "@/lib/services/material.service";
import { bulkDeleteSchema } from "@/lib/validation/inventory.schemas";
import {
  createSuccessResponse,
  createErrorResponse,
  ApiErrorCode,
} from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";

/**
 * DELETE /api/stores/[id]/materials/bulk
 *
 * Bulk delete materials.
 * Request body: { ids: string[] }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Parse and validate request body
    const body = await request.json();
    const { ids } = bulkDeleteSchema.parse(body);

    // Bulk delete materials via service
    const deletedCount = await materialService.bulkDeleteMaterials(ids, storeId);

    return NextResponse.json(
      createSuccessResponse({
        message: `Successfully deleted ${deletedCount} material(s)`,
        deletedCount,
      })
    );
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "DELETE /api/stores/[id]/materials/bulk",
      context: { storeId },
    });
  }
}
