import { NextResponse } from "next/server";
import { recipeService } from "@/lib/services/recipe.service";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { serializeRecipe, serializeRecipes } from "@/lib/server/serialize";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";

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
export const GET = withApiHandler(
  async (request, { storeId }) => {
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
    const result = await recipeService.getRecipes(storeId!, filters);

    // Serialize Decimal fields to numbers for Client Components
    return NextResponse.json(
      createSuccessResponse({
        recipes: serializeRecipes(result.recipes),
        total: result.total,
      }),
      { status: 200 }
    );
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/recipes",
    requireStoreAuth: true,
  }
);

/**
 * POST /api/stores/[id]/recipes
 * Create a new recipe
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();

    // Validate request body
    const validatedData = createRecipeSchema.parse(body);

    // Create recipe via service
    const recipe = await recipeService.createRecipe({
      storeId: storeId!,
      ...validatedData,
    });

    // Serialize Decimal fields to numbers for Client Components
    return NextResponse.json(createSuccessResponse(serializeRecipe(recipe)), { status: 201 });
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/recipes",
    requireStoreAuth: true,
  }
);

