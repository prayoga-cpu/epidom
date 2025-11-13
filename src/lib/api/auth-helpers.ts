import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { businessService } from "@/lib/services";
import { NextResponse } from "next/server";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import type { Business } from "@prisma/client";
import type { StoreDto } from "@/types/dto";

/**
 * Authorization Helpers
 *
 * Centralized authorization logic to reduce code duplication
 * and ensure consistent authorization checks across all API routes.
 *
 * Follows DRY principle - single source of truth for authorization logic
 */

export interface StoreAccessResult {
  business: Business;
  store: StoreDto;
  userId: string;
}

/**
 * Verify user has access to a store
 *
 * This function performs all necessary authorization checks:
 * 1. Verifies user is authenticated
 * 2. Verifies user has a business
 * 3. Verifies store exists
 * 4. Verifies store belongs to user's business
 *
 * @param userId - User ID from session
 * @param storeId - Store ID to verify access to
 * @returns Store access result with business and store data
 * @throws Error if authorization fails
 */
export async function verifyStoreAccess(
  userId: string | undefined,
  storeId: string
): Promise<StoreAccessResult> {
  // 1. Verify user is authenticated
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  // 2. Verify user has a business
  const business = await businessService.getBusinessByUserId(userId);
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 3. Verify store exists and belongs to business
  const store = await businessService.getStoreById(storeId);
  if (!store || store.businessId !== business.id) {
    throw new Error("STORE_NOT_FOUND_OR_UNAUTHORIZED");
  }

  return {
    business,
    store,
    userId,
  };
}

/**
 * Get authenticated user session
 *
 * Helper function to get session and extract user ID
 *
 * @returns User ID from session
 * @throws Error if not authenticated
 */
export async function getAuthenticatedUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user.id;
}

/**
 * Verify store access and return NextResponse error if failed
 *
 * This is a convenience wrapper for API routes that returns
 * appropriate NextResponse errors for failed authorization.
 *
 * @param userId - User ID from session
 * @param storeId - Store ID to verify access to
 * @returns Store access result or NextResponse error
 */
export async function verifyStoreAccessOrError(
  userId: string | undefined,
  storeId: string
): Promise<StoreAccessResult | NextResponse> {
  try {
    return await verifyStoreAccess(userId, storeId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "UNAUTHORIZED";

    switch (errorMessage) {
      case "UNAUTHORIZED":
        return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
          status: 401,
        });

      case "BUSINESS_NOT_FOUND":
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
          { status: 404 }
        );

      case "STORE_NOT_FOUND_OR_UNAUTHORIZED":
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.NOT_FOUND,
            "Store not found or does not belong to your business"
          ),
          { status: 404 }
        );

      default:
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
          { status: 500 }
        );
    }
  }
}

/**
 * Verify store access from request
 *
 * Convenience function that extracts storeId from params and
 * userId from session, then verifies access.
 *
 * @param userId - User ID from session
 * @param params - Route params containing storeId
 * @returns Store access result or NextResponse error
 */
export async function verifyStoreAccessFromRequest(
  userId: string | undefined,
  params: Promise<{ id: string }> | { id: string }
): Promise<StoreAccessResult | NextResponse> {
  const resolvedParams = params instanceof Promise ? await params : params;
  const storeId = resolvedParams.id;

  return verifyStoreAccessOrError(userId, storeId);
}
