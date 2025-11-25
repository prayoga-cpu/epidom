import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recipeService } from "@/lib/services/recipe.service";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
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
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recipeId: string }> }
) {
  let session: Session | null = null;
  try {
    // Verify authentication
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const { id: storeId, recipeId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    // Get recipe from service
    const recipe = await recipeService.getRecipeById(recipeId);

    if (!recipe) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Recipe not found"),
        { status: 404 }
      );
    }

    // Verify recipe belongs to store
    if (recipe.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.FORBIDDEN, "Recipe does not belong to this store"),
        { status: 403 }
      );
    }

    // Serialize Decimal fields to numbers for Client Components
    return NextResponse.json(createSuccessResponse(serializeRecipe(recipe)), { status: 200 });
  } catch (error) {
    const { id: storeId, recipeId } = await params;
    return handleApiError(error, {
      endpoint: "GET /api/stores/[id]/recipes/[recipeId]",
      context: { storeId, recipeId, userId: session?.user?.id },
    });
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
  let session: Session | null = null;
  try {
    // Verify authentication
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const { id: storeId, recipeId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    const body = await request.json();

    // Validate request body
    const validatedData = updateRecipeSchema.parse(body);

    // Update recipe via service
    const recipe = await recipeService.updateRecipe(recipeId, storeId, validatedData);

    // Serialize Decimal fields to numbers for Client Components
    return NextResponse.json(createSuccessResponse(serializeRecipe(recipe)), { status: 200 });
  } catch (error) {
    const { id: storeId, recipeId } = await params;
    return handleApiError(error, {
      endpoint: "PATCH /api/stores/[id]/recipes/[recipeId]",
      context: { storeId, recipeId, userId: session?.user?.id },
    });
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
  let session: Session | null = null;
  try {
    // Verify authentication
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const { id: storeId, recipeId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    // Delete recipe via service
    await recipeService.deleteRecipe(recipeId, storeId);

    return NextResponse.json(
      createSuccessResponse({ message: "Recipe deleted successfully" }),
      { status: 200 }
    );
  } catch (error) {
    const { id: storeId, recipeId } = await params;
    return handleApiError(error, {
      endpoint: "DELETE /api/stores/[id]/recipes/[recipeId]",
      context: { storeId, recipeId, userId: session?.user?.id },
    });
  }
}
