import { NextRequest, NextResponse } from "next/server";
import { productService } from "@/lib/services/product.service";
import { subscriptionService } from "@/lib/services";
import { createProductSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

// Validation schema for filtering products
const productFilterSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  sortBy: z
    .enum(["name", "sku", "currentStock", "costPrice", "sellingPrice", "createdAt", "updatedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(50),
});

/**
 * GET /api/stores/[id]/products
 * Get all products for a store with optional filtering
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const result = await verifyStoreAccessFromRequest(userId, params);

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { store } = result;
    const storeId = store.id;

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

    const filters = productFilterSchema.parse(filterParams);

    // Get products from service
    const productsData = await productService.getProducts(storeId, filters);

    return NextResponse.json(createSuccessResponse(productsData), { status: 200 });
  } catch (error) {
    console.error("Error fetching products:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "Invalid filter parameters",
          error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          }))
        ),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to fetch products"
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/stores/[id]/products
 * Create a new product
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const result = await verifyStoreAccessFromRequest(userId, params);

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { store, userId: verifiedUserId } = result;
    const storeId = store.id;

    // Check subscription plan limits (Starter = 500 products per store, Pro/Enterprise = unlimited)
    // Note: This check is separate from store access verification because it's a feature-level
    // limit that applies per store. Even if the user has access to the store, they need to
    // stay within their subscription plan's product limit.
    const productCheck = await subscriptionService.canCreateProduct(verifiedUserId, storeId);

    if (!productCheck.allowed) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
          `You have reached your plan's product limit (${productCheck.current}/${productCheck.limit}). Upgrade to Pro to add more products.`,
          {
            current: productCheck.current,
            limit: productCheck.limit,
            upgradeRequired: true,
          }
        ),
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validatedData = createProductSchema.parse({ ...body, storeId });

    // Create product via service
    const product = await productService.createProduct({
      storeId,
      sku: validatedData.sku,
      name: validatedData.name,
      description: validatedData.description,
      category: validatedData.category,
      costPrice: Number(validatedData.costPrice),
      sellingPrice: Number(validatedData.sellingPrice),
      currentStock: validatedData.currentStock ? Number(validatedData.currentStock) : 0,
      unit: validatedData.unit,
      minStock: validatedData.minStock ? Number(validatedData.minStock) : 0,
      maxStock: validatedData.maxStock ? Number(validatedData.maxStock) : undefined,
      recipeId: validatedData.recipeId,
      productionTime: validatedData.productionTime,
      shelfLife: validatedData.shelfLife,
      isActive: validatedData.isActive,
    });

    return NextResponse.json(createSuccessResponse(product), { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "Invalid input data",
          error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          }))
        ),
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Handle specific business logic errors
      if (error.message.includes("already exists")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 409 }
        );
      }
      if (error.message.includes("not found")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to create product"
      ),
      { status: 500 }
    );
  }
}
