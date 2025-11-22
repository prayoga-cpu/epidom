import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recipeService } from "@/lib/services/recipe.service";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
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

    const { id: storeId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

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

    return NextResponse.json(createSuccessResponse(result), { status: 200 });
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "GET /api/stores/[id]/recipes",
      context: { storeId, userId: session?.user?.id },
    });
  }
}

/**
 * POST /api/stores/[id]/recipes
 * Create a new recipe
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id: storeId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    const body = await request.json();

    // Validate request body
    const validatedData = createRecipeSchema.parse(body);

    // Create recipe via service
    const recipe = await recipeService.createRecipe({
      storeId,
      ...validatedData,
    });

    return NextResponse.json(createSuccessResponse(recipe), { status: 201 });
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "POST /api/stores/[id]/recipes",
      context: { storeId, userId: session?.user?.id },
    });
  }
}
