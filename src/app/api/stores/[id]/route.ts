import { NextResponse } from "next/server";
import { businessService } from "@/lib/services";
import { createStoreSchema } from "@/lib/validation/business.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { StoreNotFoundError } from "@/lib/errors";
import { beginAction, completeAction, failAction } from "@/lib/audit/record";
import { captureEntitySnapshot } from "@/lib/audit/snapshot";

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
 *
 * A cascade root ("store.delete" in the audit catalogue, SNAPSHOT_RESTORE): a
 * store fans out across products, materials, recipes, orders, staff and every
 * other store-scoped table through 56 onDelete: Cascade edges that Prisma
 * never observes. A full graph snapshot is captured immediately before the
 * delete, inside the two-phase begin/complete so a crash mid-cascade still
 * leaves evidence the attempt happened (see docs/AUDIT_LOG_PLAN.md).
 */
export const DELETE = withApiHandler(
  async (request, { userId, storeId }) => {
    // withApiHandler's requireStoreAuth already confirmed the store exists and
    // belongs to this user; this lookup is only to capture its name and
    // businessId for the audit row before they are gone.
    const store = await businessService.getStoreById(storeId!);
    const storeName = store.name;

    const actionLogId = await beginAction({
      actionType: "store.delete",
      storeId: storeId!,
      targetId: storeId!,
      payload: { storeId: storeId!, storeName, snapshotId: null, rowCount: 0 },
    });

    try {
      const snapshot = await captureEntitySnapshot({
        rootType: "Store",
        rootId: storeId!,
        rootLabel: storeName,
        reasonCode: "store.delete",
        storeId: storeId!,
        businessId: store.businessId,
      });

      // Single service call - handles business lookup + delete + image cleanup
      await businessService.deleteStoreForUser(storeId!, userId);

      await completeAction(actionLogId, {
        snapshotId: snapshot?.id ?? null,
        payload: { storeId: storeId!, storeName, snapshotId: snapshot?.id ?? null, rowCount: snapshot?.rowCount ?? 0 },
      });

      return NextResponse.json(createSuccessResponse({ message: "Store deleted successfully" }));
    } catch (error) {
      await failAction(actionLogId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  },
  {
    rateLimitEndpoint: "/api/stores/[id]",
    requireStoreAuth: true,
  }
);
