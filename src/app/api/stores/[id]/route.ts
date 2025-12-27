import { NextResponse } from "next/server";
import { businessService } from "@/lib/services";
import { createStoreSchema } from "@/lib/validation/business.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { StoreNotFoundError } from "@/lib/errors";

/**
 * GET /api/stores/[id]
 *
 * Get a single store by ID.
 *
 * Authentication and store ownership are handled by withApiHandler
 * when requireStoreAuth is true.
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const store = await businessService.getStoreById(storeId!);

    if (!store) {
      throw new StoreNotFoundError(storeId);
    }

    return NextResponse.json(createSuccessResponse(store));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]",
    requireStoreAuth: true,
  }
);

/**
 * PATCH /api/stores/[id]
 *
 * Update a store.
 * Uses simplified service method that handles business lookup internally.
 *
 * Errors mapped automatically:
 * - BusinessNotFoundError → 404
 * - StoreNotFoundError → 404
 * - ForbiddenError → 403
 */
export const PATCH = withApiHandler(
  async (request, { userId, storeId }) => {
    const body = await request.json();
    const input = createStoreSchema.partial().parse(body);

    // Single service call - handles business lookup internally
    const updatedStore = await businessService.updateStoreForUser(storeId!, userId, input);

    return NextResponse.json(createSuccessResponse(updatedStore));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]",
    requireStoreAuth: true,
  }
);

/**
 * DELETE /api/stores/[id]
 *
 * Hard delete a store and its image from Blob storage.
 * Uses simplified service method that handles business lookup internally.
 *
 * Errors mapped automatically:
 * - BusinessNotFoundError → 404
 * - StoreNotFoundError → 404
 * - ForbiddenError → 403
 */
export const DELETE = withApiHandler(
  async (request, { userId, storeId }) => {
    // Single service call - handles business lookup + delete + image cleanup
    await businessService.deleteStoreForUser(storeId!, userId);

    return NextResponse.json(createSuccessResponse({ message: "Store deleted successfully" }));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]",
    requireStoreAuth: true,
  }
);
