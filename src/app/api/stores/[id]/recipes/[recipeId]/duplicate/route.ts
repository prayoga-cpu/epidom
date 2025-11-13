import { NextRequest, NextResponse } from "next/server";
import { recipeService } from "@/lib/services/recipe.service";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

// Validation schema for duplicating recipe
const duplicateRecipeSchema = z.object({
  newName: z.string().min(1, "New name is required").max(200, "Name is too long"),
});

/**
 * POST /api/stores/[id]/recipes/[recipeId]/duplicate
 * Duplicate a recipe with a new name
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recipeId: string }> }
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

    const { id: storeId, recipeId } = resolvedParams;
    const body = await request.json();

    // Validate request body
    const { newName } = duplicateRecipeSchema.parse(body);

    // Duplicate recipe via service
    const recipe = await recipeService.duplicateRecipe(recipeId, newName, storeId);

    return NextResponse.json(createSuccessResponse(recipe), { status: 201 });
  } catch (error) {
    console.error("Error duplicating recipe:", error);

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
      if (error.message.includes("already exists")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 409 }
        );
      }
      if (error.message.includes("not found") || error.message.includes("does not belong")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to duplicate recipe"
      ),
      { status: 500 }
    );
  }
}
