import { NextResponse } from "next/server";
import { materialService } from "@/lib/services/material.service";
import { createIngredientSchema, materialFilterSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { ZodError } from "zod";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

/**
 * GET /api/stores/[id]/materials
 *
 * Get all materials for a store with optional filtering.
 * Query params: search, category, supplierId, stockStatus, sortBy, sortOrder, skip, take
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const filters = materialFilterSchema.parse({
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      supplierId: searchParams.get("supplierId") || undefined,
      stockStatus: searchParams.get("stockStatus") || undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
      skip: searchParams.get("skip") || 0,
      take: searchParams.get("take") || 50,
    });

    // Get materials with filters
    const materialsData = await materialService.getMaterials(storeId, filters);

    return NextResponse.json(createSuccessResponse(materialsData));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "Invalid query parameters",
          error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          }))
        ),
        { status: 400 }
      );
    }

    console.error("Error fetching materials:", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}

/**
 * POST /api/stores/[id]/materials
 *
 * Create a new material for a store.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    // Parse and validate request body
    const body = await request.json();
    const input = createIngredientSchema.parse({ ...body, storeId });

    // Create material via service
    const material = await materialService.createMaterial(input);

    return NextResponse.json(createSuccessResponse(material), {
      status: 201,
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof ZodError) {
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

    // Handle business logic errors
    if (error instanceof Error) {
      console.error("Error creating material:", error.message);

      // Check for specific error messages
      if (error.message.includes("SKU already exists")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 409 }
        );
      }
    }

    console.error("Error creating material:", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}
