import { NextResponse } from "next/server";
import { materialService } from "@/lib/services/material.service";
import { categoryDeleteSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * DELETE /api/stores/[id]/materials/categories/[category]
 *
 * Delete a category. Materials have no separate category entity, so this
 * affects every material that uses it. Request body: { mode?: "uncategorize"
 * | "delete" }. "uncategorize" (default) clears the category field, keeping
 * the materials. "delete" hard-deletes every material in that category.
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

    const { count } = await materialService.deleteCategory(storeId!, category, mode);

    return NextResponse.json(
      createSuccessResponse({
        message:
          mode === "delete"
            ? `Deleted ${count} material(s) in this category`
            : `Category removed from ${count} material(s)`,
        count,
        mode,
      })
    );
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/materials/categories/[category]",
    requireStoreAuth: true,
  }
);
