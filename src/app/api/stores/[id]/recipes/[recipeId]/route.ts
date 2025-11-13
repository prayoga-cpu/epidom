import { NextRequest, NextResponse } from "next/server";
import { recipeService } from "@/lib/services/recipe.service";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import { cuidSchema } from "@/lib/validation/common.schemas";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

// Validation schema for updating recipe
const recipeIngredientSchema = z.object({
  materialId: cuidSchema,
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.string().min(1, "Unit is required").max(20, "Unit is too long"),
  notes: z.string().max(500, "Notes are too long").optional(),
});

const updateRecipeSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long").optional(),
  description: z.string().max(1000, "Description is too long").optional(),
  category: z.string().max(100, "Category name is too long").optional(),
  yieldQuantity: z.number().positive("Yield quantity must be positive").optional(),
  yieldUnit: z
    .string()
    .min(1, "Yield unit is required")
    .max(20, "Yield unit is too long")
    .optional(),
  productionTimeMinutes: z
    .number()
    .int()
    .nonnegative("Production time must be non-negative")
    .optional(),
  instructions: z.string().max(5000, "Instructions are too long").optional(),
  ingredients: z.array(recipeIngredientSchema).optional(),
});

/**
 * GET /api/stores/[id]/recipes/[recipeId]
 * Get a specific recipe by ID
 */
export async function GET(
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

    const { recipeId } = resolvedParams;

    // Get recipe from service
    const recipe = await recipeService.getRecipeById(recipeId);

    if (!recipe) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Recipe not found"),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse(recipe), { status: 200 });
  } catch (error) {
    console.error("Error fetching recipe:", error);

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to fetch recipe"
      ),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stores/[id]/recipes/[recipeId]
 * Update a recipe
 */
export async function PATCH(
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
    const validatedData = updateRecipeSchema.parse(body);

    // Update recipe via service
    const recipe = await recipeService.updateRecipe(recipeId, storeId, validatedData);

    return NextResponse.json(createSuccessResponse(recipe), { status: 200 });
  } catch (error) {
    console.error("Error updating recipe:", error);

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
        error instanceof Error ? error.message : "Failed to update recipe"
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stores/[id]/recipes/[recipeId]
 * Delete a recipe
 */
export async function DELETE(
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

    // Delete recipe via service
    await recipeService.deleteRecipe(recipeId, storeId);

    return NextResponse.json(
      createSuccessResponse({ message: "Recipe deleted successfully" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting recipe:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("does not belong")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
      if (error.message.includes("used in")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to delete recipe"
      ),
      { status: 500 }
    );
  }
}
