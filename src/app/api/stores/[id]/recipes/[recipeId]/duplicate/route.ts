import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recipeService } from "@/lib/services/recipe.service";
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
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId, recipeId } = await params;
    const body = await request.json();

    // Validate request body
    const { newName } = duplicateRecipeSchema.parse(body);

    // Duplicate recipe via service
    const recipe = await recipeService.duplicateRecipe(recipeId, newName, storeId);

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    console.error("Error duplicating recipe:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Handle specific business logic errors
      if (error.message.includes("already exists")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.message.includes("not found") || error.message.includes("does not belong")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to duplicate recipe" },
      { status: 500 }
    );
  }
}
