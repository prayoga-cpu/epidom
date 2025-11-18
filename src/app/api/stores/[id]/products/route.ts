import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { productService } from "@/lib/services/product.service";
import { subscriptionService } from "@/lib/services";
import { createProductSchema } from "@/lib/validation/inventory.schemas";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";

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

    const filters = productFilterSchema.parse(filterParams);

    // Get products from service
    const result = await productService.getProducts(storeId, filters);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid filter parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch products" },
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
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId } = await params;

    // Check subscription plan limits (Starter = 500 products per store, Pro/Enterprise = unlimited)
    const productCheck = await subscriptionService.canCreateProduct(session.user.id, storeId);

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
      recipeIds: validatedData.recipeIds,
      productionTime: validatedData.productionTime,
      shelfLife: validatedData.shelfLife,
      isActive: validatedData.isActive,
    });

    return NextResponse.json(product, { status: 201 });
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
      { error: error instanceof Error ? error.message : "Failed to create product" },
      { status: 500 }
    );
  }
}
