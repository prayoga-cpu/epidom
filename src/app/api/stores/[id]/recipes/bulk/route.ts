import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recipeService } from "@/lib/services/recipe.service";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { z } from "zod";

// Validation schema for bulk delete
const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one recipe ID is required"),
});

/**
 * DELETE /api/stores/[id]/recipes/bulk
 * Bulk delete multiple recipes
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { ids } = bulkDeleteSchema.parse(body);

    // Bulk delete recipes via service
    const count = await recipeService.bulkDeleteRecipes(ids, storeId);

    return NextResponse.json(
      createSuccessResponse({ message: `Successfully deleted ${count} recipe(s)`, count }),
      { status: 200 }
    );
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "DELETE /api/stores/[id]/recipes/bulk",
      context: { storeId },
    });
  }
}
