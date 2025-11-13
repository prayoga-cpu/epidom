import { NextRequest, NextResponse } from "next/server";
import { recipeService } from "@/lib/services/recipe.service";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

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
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const result = await verifyStoreAccessFromRequest(userId, params);

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { id: storeId } = await params;
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
    console.error("Error bulk deleting recipes:", error);

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
      if (error.message.includes("not found") || error.message.includes("do not belong")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to delete recipes"
      ),
      { status: 500 }
    );
  }
}
