import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { recipeService } from "@/lib/services/recipe.service";
import { createSuccessResponse } from "@/types/api/responses";
import { serializeRecipe } from "@/lib/server/serialize";
import { z } from "zod";

// Validation schema for duplicating recipe
const duplicateRecipeSchema = z.object({
  newName: z.string().min(1, "New name is required").max(200, "Name is too long"),
});

/**
 * POST /api/stores/[id]/recipes/[recipeId]/duplicate
 * Duplicate a recipe with a new name
 */
export const POST = withApiHandler(
  async (request, { storeId, params }) => {
    const { recipeId } = params;
    const body = await request.json();
    const { newName } = duplicateRecipeSchema.parse(body);

    // Duplicate recipe via service
    const recipe = await recipeService.duplicateRecipe(recipeId, newName, storeId!);

    // Serialize Decimal fields to numbers for Client Components
    return NextResponse.json(createSuccessResponse(serializeRecipe(recipe)), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/recipes/[recipeId]/duplicate", requireStoreAuth: true }
);
