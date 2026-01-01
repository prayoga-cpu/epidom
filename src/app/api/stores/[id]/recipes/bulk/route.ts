import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { recipeService } from "@/lib/services/recipe.service";
import { createSuccessResponse } from "@/types/api/responses";
import { z } from "zod";

// Validation schema for bulk delete
const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one recipe ID is required"),
});

/**
 * DELETE /api/stores/[id]/recipes/bulk
 * Bulk delete multiple recipes
 */
export const DELETE = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const { ids } = bulkDeleteSchema.parse(body);

    // Bulk delete recipes via service
    const { count } = await recipeService.bulkDeleteRecipes(ids, storeId!);

    return NextResponse.json(
      createSuccessResponse({ message: `Successfully deleted ${count} recipe(s)`, count })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/recipes/bulk", requireStoreAuth: true }
);
