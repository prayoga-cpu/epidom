import { NextResponse } from "next/server";
import { productService } from "@/lib/services/product.service";
import { subscriptionService } from "@/lib/services";
import { createProductSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { serializeProduct, serializeProducts } from "@/lib/server/serialize";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";

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

    const filters = productFilterSchema.parse(filterParams);

    // Get products from service
    const result = await productService.getProducts(storeId!, filters);

    // Serialize Decimal fields to numbers for Client Components
    return NextResponse.json(
      createSuccessResponse({
        products: serializeProducts(result.products),
        total: result.total,
      }),
      { status: 200 }
    );
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/products",
    requireStoreAuth: true,
  }
);

/**
 * POST /api/stores/[id]/products
 * Create a new product
 */
export const POST = withApiHandler(
  async (request, { storeId, userId }) => {
    // Check subscription plan limits (Starter = 500 products per store, Pro/Enterprise = unlimited)
    const productCheck = await subscriptionService.canCreateProduct(userId, storeId!);

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
      storeId: storeId!,
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
      recipeIds: validatedData.recipeIds,
      productionTime: validatedData.productionTime,
      shelfLife: validatedData.shelfLife,
      isActive: validatedData.isActive,
    });

    // Serialize Decimal fields to numbers for Client Components
    return NextResponse.json(createSuccessResponse(serializeProduct(product)), { status: 201 });
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/products",
    requireStoreAuth: true,
  }
);

