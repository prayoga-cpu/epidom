/**
 * Store Ownership Verification Utility
 *
 * Provides a reusable function to verify that a user owns a store
 * through their business. Used to ensure proper authorization
 * across all store-scoped API routes.
 */

import { cache } from "react";
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
 * react-cached per request (same pattern as getSession in src/lib/auth.ts):
 * several routes verify the same store more than once in a single request —
 * a layout, then the page, then a service below it — and each one was paying
 * for the lookup again.
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
export const verifyStoreOwnership = cache(async function verifyStoreOwnership(
  storeId: string,
  userId: string
): Promise<Store> {
  // The two lookups don't depend on each other, so they run together rather
  // than back to back — this sits in the critical path of nearly every
  // store-scoped page and API route (29 call sites), and it was costing two
  // serial round trips before anything could render.
  //
  // The checks below still run in the original order, so the error a caller
  // sees for a given input is unchanged.
  const [business, store] = await Promise.all([
    businessService.getBusinessByUserId(userId),
    businessService.getStoreById(storeId),
  ]);

  if (!business) {
    throw new Error("Business not found");
  }

  if (!store) {
    throw new Error("Store not found");
  }

  // Verify store belongs to business
  if (store.businessId !== business.id) {
    throw new Error("Store not found or does not belong to your business");
  }

  return store;
});

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
      if (error.message === "Store not found" || error.message.includes("does not belong")) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, error.message), {
          status: 404,
        });
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
