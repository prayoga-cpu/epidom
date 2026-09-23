import { NextResponse } from "next/server";
import { businessService } from "@/lib/services";
import { createStoreSchema } from "@/lib/validation/business.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { getLinkedStaffForUser, linkedStaffLandingPath } from "@/lib/auth/staff-link";

/**
 * GET /api/stores
 *
 * Every store the current account can enter: the ones its business owns, plus
 * the one it is linked to as a staff member (at most one). Each row says which
 * — `accessRole` — because a staff row must not offer owner actions (edit,
 * delete, Back Office) and points straight at the POS page they can reach.
 */
export const GET = withApiHandler(
  async (request, { userId }) => {
    const business = await businessService.getBusinessByUserId(userId);
    const owned = business ? await businessService.getStoresByBusinessId(business.id) : [];
    const ownedRows = owned.map((store) => ({ ...store, accessRole: "owner" as const }));

    const link = await getLinkedStaffForUser(userId);
    // Owner access outranks staff access to the same store (someone linked as
    // staff who later became the owner through a transfer) — never list it twice.
    if (!link || owned.some((store) => store.id === link.storeId)) {
      return NextResponse.json(createSuccessResponse(ownedRows));
    }

    return NextResponse.json(
      createSuccessResponse([
        ...ownedRows,
        {
          ...link.store,
          accessRole: "staff" as const,
          // Null = their role has no POS page (a back-office-only role): the
          // card renders but has nowhere to go.
          staffHomePath: linkedStaffLandingPath(link),
        },
      ])
    );
  },
  {
    rateLimitEndpoint: "/api/stores",
  }
);

/**
 * POST /api/stores
 *
 * Create a new store for the current user's business.
 * Auto-creates business if not exists.
 *
 * All business logic handled by service:
 * - Auto-create business if missing
 * - Check subscription status
 * - Check store limit
 * - Create store in transaction
 *
 * Errors thrown by service are automatically mapped to HTTP responses:
 * - SubscriptionInactiveError → 403
 * - StoreLimitExceededError → 403 with upgradeRequired: true
 * - ConflictError → 409 (store name exists)
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json();
    const input = createStoreSchema.parse(body);

    // Single service call - all logic handled internally
    const store = await businessService.createStoreForUser(userId, input);

    return NextResponse.json(createSuccessResponse(store), { status: 201 });
  },
  {
    rateLimitEndpoint: "/api/stores",
  }
);
