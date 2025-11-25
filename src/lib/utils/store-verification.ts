/**
 * Store Ownership Verification Utility
 *
 * Provides a reusable function to verify that a user owns a store
 * through their business. Used to ensure proper authorization
 * across all store-scoped API routes.
 */

import { Store } from "@prisma/client";
import { businessService } from "@/lib/services";
import { ApiErrorCode, createErrorResponse } from "@/types/api/responses";
import { NextResponse } from "next/server";

/**
 * Verify that a user owns a store through their business
 *
 * @param storeId - The store ID to verify
 * @param userId - The user ID to verify ownership
 * @returns The store object if valid
 * @throws Error if verification fails
 *
 * @example
 * ```ts
 * try {
 *   const store = await verifyStoreOwnership(storeId, session.user.id);
 *   // Use store for operations
 * } catch (error) {
 *   return handleApiError(error, { endpoint: "...", context: {...} });
 * }
 * ```
 */
export async function verifyStoreOwnership(
  storeId: string,
  userId: string
): Promise<Store> {
  // Get user's business
  const business = await businessService.getBusinessByUserId(userId);
  if (!business) {
    throw new Error("Business not found");
  }

  // Get store by ID
  const store = await businessService.getStoreById(storeId);
  if (!store) {
    throw new Error("Store not found");
  }

  // Verify store belongs to business
  if (store.businessId !== business.id) {
    throw new Error("Store not found or does not belong to your business");
  }

  return store;
}

/**
 * Verify store ownership and return NextResponse error if failed
 * Use this when you need to return an error response directly
 *
 * @param storeId - The store ID to verify
 * @param userId - The user ID to verify ownership
 * @returns The store object if valid, or NextResponse error if invalid
 *
 * @example
 * ```ts
 * const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
 * if (verification instanceof NextResponse) {
 *   return verification; // Error response
 * }
 * const store = verification; // Store object
 * ```
 */
export async function verifyStoreOwnershipWithResponse(
  storeId: string,
  userId: string
): Promise<Store | NextResponse> {
  try {
    const store = await verifyStoreOwnership(storeId, userId);
    return store;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Business not found") {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, error.message),
          { status: 404 }
        );
      }
      if (
        error.message === "Store not found" ||
        error.message.includes("does not belong")
      ) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, error.message),
          { status: 404 }
        );
      }
    }
    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        "An unexpected error occurred during store verification"
      ),
      { status: 500 }
    );
  }
}

