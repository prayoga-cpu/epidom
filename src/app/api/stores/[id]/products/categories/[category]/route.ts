import { NextResponse } from "next/server";
import { productService } from "@/lib/services/product.service";
import { categoryDeleteSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * DELETE /api/stores/[id]/products/categories/[category]
 *
 * Delete a category. Products have no separate category entity, so this
 * affects every product that uses it. Request body: { mode?: "uncategorize"
 * | "delete" }. "uncategorize" (default) clears the category field, keeping
 * the products. "delete" hard-deletes every product in that category.
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

    const { count } = await productService.deleteCategory(storeId!, category, mode);

    return NextResponse.json(
      createSuccessResponse({
        message:
          mode === "delete"
            ? `Deleted ${count} product(s) in this category`
            : `Category removed from ${count} product(s)`,
        count,
        mode,
      })
    );
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/products/categories/[category]",
    requireStoreAuth: true,
  }
);
