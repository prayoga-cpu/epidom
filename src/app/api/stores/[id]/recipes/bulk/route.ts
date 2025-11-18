import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recipeService } from "@/lib/services/recipe.service";
import { z } from "zod";

// Validation schema for bulk delete
const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one recipe ID is required"),
});

/**
 * DELETE /api/stores/[id]/recipes/bulk
 * Bulk delete multiple recipes
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId } = await params;
    const body = await request.json();

    // Validate request body
    const { ids } = bulkDeleteSchema.parse(body);

    // Bulk delete recipes via service
    const count = await recipeService.bulkDeleteRecipes(ids, storeId);

    return NextResponse.json(
      { message: `Successfully deleted ${count} recipe(s)`, count },
      { status: 200 }
    );
  } catch (error) {

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("do not belong")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete recipes" },
      { status: 500 }
    );
  }
}
