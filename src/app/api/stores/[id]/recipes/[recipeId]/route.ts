import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { recipeService } from "@/lib/services/recipe.service";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { serializeRecipe } from "@/lib/server/serialize";
import { z } from "zod";
import { cuidSchema } from "@/lib/validation/common.schemas";

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
export const GET = withApiHandler(
  async (request, { storeId, params }) => {
    const { recipeId } = params;

    // Get recipe from service
    const recipe = await recipeService.getRecipeById(recipeId);

    if (!recipe) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Recipe not found"), {
        status: 404,
      });
    }

    // Verify recipe belongs to store
    if (recipe.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.FORBIDDEN, "Recipe does not belong to this store"),
        { status: 403 }
      );
    }

    // Serialize Decimal fields to numbers for Client Components
    return NextResponse.json(createSuccessResponse(serializeRecipe(recipe)));
  },
  { rateLimitEndpoint: "/api/stores/[id]/recipes/[recipeId]", requireStoreAuth: true }
);

/**
 * PATCH /api/stores/[id]/recipes/[recipeId]
 * Update a recipe
 */
export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const { recipeId } = params;
    const body = await request.json();
    const validatedData = updateRecipeSchema.parse(body);

    // Update recipe via service
    const recipe = await recipeService.updateRecipe(recipeId, storeId!, validatedData);

    // Serialize Decimal fields to numbers for Client Components
    return NextResponse.json(createSuccessResponse(serializeRecipe(recipe)));
  },
  { rateLimitEndpoint: "/api/stores/[id]/recipes/[recipeId]", requireStoreAuth: true }
);

/**
 * DELETE /api/stores/[id]/recipes/[recipeId]
 * Delete a recipe
 */
export const DELETE = withApiHandler(
  async (request, { storeId, params }) => {
    const { recipeId } = params;

    // Delete recipe via service
    await recipeService.deleteRecipe(recipeId, storeId!);

    return NextResponse.json(createSuccessResponse({ message: "Recipe deleted successfully" }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/recipes/[recipeId]", requireStoreAuth: true }
);
