import { NextResponse } from "next/server";
import { recipeService } from "@/lib/services/recipe.service";
import { categoryDeleteSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * DELETE /api/stores/[id]/recipes/categories/[category]
 *
 * Delete a category. Recipe categories are a fixed preset list, not a
 * separate entity, so this affects every recipe that uses it. Request body:
 * { mode?: "uncategorize" | "delete" }. "uncategorize" (default) clears the
 * category field, keeping the recipes. "delete" hard-deletes every recipe
 * in that category.
 */
export const DELETE = withApiHandler(
  async (request, { storeId, params }) => {
    const category = decodeURIComponent(params.category);

    if (!category.trim()) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "Category is required"),
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { mode } = categoryDeleteSchema.parse(body);

    const { count } = await recipeService.deleteCategory(storeId!, category, mode);

    return NextResponse.json(
      createSuccessResponse({
        message:
          mode === "delete"
            ? `Deleted ${count} recipe(s) in this category`
            : `Category removed from ${count} recipe(s)`,
        count,
        mode,
      })
    );
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/recipes/categories/[category]",
    requireStoreAuth: true,
  }
);
