import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { businessService, subscriptionService } from "@/lib/services";
import { createStoreSchema } from "@/lib/validation/business.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { handleApiError } from "@/lib/utils/api-error-handler";

/**
 * GET /api/stores
 *
 * Get all stores for the current user's business.
 */
export async function GET() {
  let session: Session | null = null;
  try {
    session = await getServerSession(authOptions);

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
    return handleApiError(error, {
      endpoint: "GET /api/stores",
      context: { userId: session?.user?.id },
    });
  }
}

/**
 * POST /api/stores
 *
 * Create a new store for the current user's business.
 */
export async function POST(request: Request) {
  let session: Session | null = null;
  try {
    session = await getServerSession(authOptions);

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
    return handleApiError(error, {
      endpoint: "POST /api/stores",
      context: { userId: session?.user?.id },
    });
  }
}
