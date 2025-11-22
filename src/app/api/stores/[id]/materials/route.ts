import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { materialService } from "@/lib/services/material.service";
import { createIngredientSchema, materialFilterSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";

/**
 * GET /api/stores/[id]/materials
 *
 * Get all materials for a store with optional filtering.
 * Query params: search, category, supplierId, stockStatus, sortBy, sortOrder, skip, take
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Rate limiting check
    const rateLimitResult = await rateLimitMiddleware(request, "/api/stores/[id]/materials");
    if (rateLimitResult) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.RATE_LIMIT_EXCEEDED,
          `Rate limit exceeded. Please try again in ${rateLimitResult.reset} seconds.`
        ),
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          },
        }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    const { id: storeId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

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
    const result = await materialService.getMaterials(storeId, filters);

    return NextResponse.json(createSuccessResponse(result));
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "GET /api/stores/[id]/materials",
      context: { storeId },
    });
  }
}

/**
 * POST /api/stores/[id]/materials
 *
 * Create a new material for a store.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Rate limiting check
    const rateLimitResult = await rateLimitMiddleware(request, "/api/stores/[id]/materials");
    if (rateLimitResult) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.RATE_LIMIT_EXCEEDED,
          `Rate limit exceeded. Please try again in ${rateLimitResult.reset} seconds.`
        ),
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          },
        }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    const { id: storeId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    // Parse and validate request body
    const body = await request.json();
    const input = createIngredientSchema.parse({ ...body, storeId });

    // Create material via service
    const material = await materialService.createMaterial(input);

    return NextResponse.json(createSuccessResponse(material), {
      status: 201,
    });
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "POST /api/stores/[id]/materials",
      context: { storeId },
    });
  }
}
