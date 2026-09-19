/**
 * Store Ownership Verification Utility
 *
 * Provides a reusable function to verify that a user owns a store
 * through their business. Used to ensure proper authorization
 * across all store-scoped API routes.
 */

import { cache } from "react";
import { Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { businessService } from "@/lib/services";
import { authorizeStaffPrincipal } from "@/lib/auth/staff-principal-policy";
import { linkedStaffWhere } from "@/lib/auth/staff-link";
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

/** How a signed-in user is allowed into a store. */
export type StoreAccess =
  | { store: Store; accessType: "owner" }
  | {
      store: Store;
      accessType: "staff";
      /** The StaffMember row this account is linked to at THIS store — the
       * only persona this principal may ever act as. */
      staffMemberId: string;
    };

/**
 * "Who is this signed-in user AT this store?" — the store's owner, or an
 * account linked to an ACTIVE StaffMember at exactly this store
 * (StaffMember.userId). Throws when they are neither.
 *
 * This only IDENTIFIES the principal; it does not decide what they may do. A
 * "staff" result must still be authorized — API routes through
 * authorizeStaffPrincipal (src/lib/auth/staff-principal-policy.ts, a
 * default-deny allow-list), pages through the viewer-aware guards in
 * src/lib/auth/. It is deliberately a SEPARATE function rather than a
 * widening of verifyStoreOwnership, which stays owner-only for the code that
 * really means "the account owner" (billing, business settings, ownership
 * transfer, ...).
 *
 * Re-derives `isActive` live on every call (react-cached per request only,
 * never across requests) — the same "never cache the revocable fact" pattern
 * as getActiveStaffSession() in src/lib/staff-session.ts, so deactivating or
 * unlinking someone closes this on their very next request, no purge job.
 *
 * Owner wins when someone is both (e.g. a linked staffer who later becomes
 * the store's owner through an ownership transfer).
 */
export const verifyStoreAccess = cache(async function verifyStoreAccess(
  storeId: string,
  userId: string
): Promise<StoreAccess> {
  try {
    const store = await verifyStoreOwnership(storeId, userId);
    return { store, accessType: "owner" };
  } catch (ownerError) {
    // role !== OWNER: the owner's own StaffMember row is not a way in (it has
    // no PIN persona to constrain and full-page defaults); a linked account is
    // by definition someone who is NOT the owner.
    const link = await prisma.staffMember.findFirst({
      where: { storeId, ...linkedStaffWhere(userId) },
      select: { id: true },
    });
    if (!link) throw ownerError;

    const store = await businessService.getStoreById(storeId);
    if (!store) throw ownerError;

    return { store, accessType: "staff", staffMemberId: link.id };
  }
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
    return verificationErrorResponse(error);
  }
}

/**
 * The plain-handler counterpart of withApiHandler's store auth, for routes
 * that check access inline. Owner or linked staff — and a linked staff account
 * is then authorized against the default-deny policy for THIS request
 * (authorizeStaffPrincipal), which is why it needs the request itself.
 *
 * Swapping a route from verifyStoreOwnershipWithResponse to this one is the
 * explicit act of letting staff accounts near it; the route must ALSO have an
 * entry in staff-principal-policy.ts or staff are still refused (403).
 */
export async function verifyStoreAccessWithResponse(
  storeId: string,
  userId: string,
  request: Request
): Promise<StoreAccess | NextResponse> {
  let access: StoreAccess;
  try {
    access = await verifyStoreAccess(storeId, userId);
  } catch (error) {
    return verificationErrorResponse(error);
  }

  if (access.accessType === "staff") {
    const denied = await authorizeStaffPrincipal({
      storeId,
      staffMemberId: access.staffMemberId,
      request,
    });
    if (denied) return denied;
  }
  return access;
}

function verificationErrorResponse(error: unknown): NextResponse {
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
