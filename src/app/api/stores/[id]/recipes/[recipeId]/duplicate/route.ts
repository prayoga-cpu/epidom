import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recipeService } from "@/lib/services/recipe.service";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
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
export async function POST(
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
    const { newName } = duplicateRecipeSchema.parse(body);

    // Duplicate recipe via service
    const recipe = await recipeService.duplicateRecipe(recipeId, newName, storeId);

    // Serialize Decimal fields to numbers for Client Components
    return NextResponse.json(createSuccessResponse(serializeRecipe(recipe)), { status: 201 });
  } catch (error) {
    const { id: storeId, recipeId } = await params;
    return handleApiError(error, {
      endpoint: "POST /api/stores/[id]/recipes/[recipeId]/duplicate",
      context: { storeId, recipeId, userId: session?.user?.id },
    });
  }
}
