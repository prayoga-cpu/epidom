import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { businessService, subscriptionService } from "@/lib/services";
import { createStoreSchema } from "@/lib/validation/business.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { ZodError } from "zod";

/**
 * GET /api/stores
 *
 * Get all stores for the current user's business.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    // Get user's business first
    const business = await businessService.getBusinessByUserId(session.user.id);

    if (!business) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.BUSINESS_NOT_FOUND,
          "Business not found. Please create a business first."
        ),
        { status: 404 }
      );
    }

    // Get all stores for the business
    const stores = await businessService.getStoresByBusinessId(business.id);

    return NextResponse.json(createSuccessResponse(stores));
  } catch (error) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}

/**
 * POST /api/stores
 *
 * Create a new store for the current user's business.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    // Get user's business
    const business = await businessService.getBusinessByUserId(session.user.id);

    if (!business) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.BUSINESS_NOT_FOUND,
          "Business not found. Please create a business first."
        ),
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();

    const input = createStoreSchema.parse(body);

    // Create store via service
    // IMPORTANT: Store limit check is performed inside createStore() method
    // using a transaction with row-level lock to prevent race conditions.
    // This ensures that concurrent requests cannot create more stores than allowed.
    // The service will throw an error if the limit is exceeded.
    try {
      const store = await businessService.createStore(business.id, session.user.id, input);

      return NextResponse.json(createSuccessResponse(store), { status: 201 });
    } catch (storeError) {
      // Handle store limit exceeded error (from service)
      if (storeError instanceof Error && storeError.message.includes("store limit")) {
        // Extract limit info from error message or check subscription again for error response
        const storeCheck = await subscriptionService.canCreateStore(session.user.id);
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
            storeError.message,
            {
              current: storeCheck.current,
              limit: storeCheck.limit,
              upgradeRequired: true,
            }
          ),
          { status: 403 }
        );
      }

      // Re-throw to be handled by outer catch
      throw storeError;
    }
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

    // Handle business logic errors (subscription, name duplicate, etc.)
    if (error instanceof Error) {
      // Check if it's a subscription error
      if (error.message.includes("subscription") || error.message.includes("No active subscription")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.UNAUTHORIZED, error.message),
          { status: 403 }
        );
      }

      // Check if it's a duplicate name error
      if (error.message.includes("already exists")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 400 }
        );
      }

      // Check if it's a business not found or unauthorized error
      if (error.message.includes("Business not found") || error.message.includes("Unauthorized")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.UNAUTHORIZED, error.message),
          { status: 403 }
        );
      }

      // Check if it's a transaction timeout or deadlock error
      if (
        error.message.includes("timeout") ||
        error.message.includes("deadlock") ||
        error.message.includes("lock") ||
        error.message.includes("P2034") // Prisma transaction timeout error code
      ) {
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.INTERNAL_ERROR,
            "The request is taking too long. Please try again in a moment."
          ),
          { status: 503 } // Service Unavailable
        );
      }
    }
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}
