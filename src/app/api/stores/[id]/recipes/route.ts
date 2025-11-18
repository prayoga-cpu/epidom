import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recipeService } from "@/lib/services/recipe.service";
import { z } from "zod";

// Validation schema for creating recipe
const createRecipeSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  category: z.string().max(100, "Category name is too long").optional(),
  yieldQuantity: z.number().positive("Yield quantity must be positive"),
  yieldUnit: z.string().min(1, "Yield unit is required").max(20, "Yield unit is too long"),
  productionTimeMinutes: z.number().int().nonnegative("Production time must be non-negative"),
  instructions: z.string().max(5000, "Instructions are too long").optional(),
  ingredients: z
    .array(
      z.object({
        materialId: z.string(),
        quantity: z.number().positive("Quantity must be positive"),
        unit: z.string().min(1, "Unit is required").max(20, "Unit is too long"),
        notes: z.string().max(500, "Notes are too long").optional(),
      })
    )
    .optional(),
});

// Validation schema for filtering recipes
const recipeFilterSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  sortBy: z
    .enum(["name", "category", "productionTimeMinutes", "costPerBatch", "createdAt", "updatedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(50),
});

/**
 * GET /api/stores/[id]/recipes
 * Get all recipes for a store with optional filtering
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId } = await params;

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const filterParams = {
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
      skip: searchParams.get("skip") || "0",
      take: searchParams.get("take") || "50",
    };

    const filters = recipeFilterSchema.parse(filterParams);

    // Get recipes from service
    const result = await recipeService.getRecipes(storeId, filters);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid filter parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch recipes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stores/[id]/recipes
 * Create a new recipe
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId } = await params;
    const body = await request.json();

    // Validate request body
    const validatedData = createRecipeSchema.parse(body);

    // Create recipe via service
    const recipe = await recipeService.createRecipe({
      storeId,
      ...validatedData,
    });

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {

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
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create recipe" },
      { status: 500 }
    );
  }
}
