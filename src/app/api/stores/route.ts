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
 * Body: createStoreSchema — the store columns plus the optional `countryCode`
 * (stored as the country's English name) and `financeSource` ({ mode: "copy",
 * storeId } or { mode: "country", currency? }). A body with only the store
 * columns behaves as before.
 *
 * All business logic handled by service:
 * - Auto-create business if missing
 * - Check subscription status
 * - Check store limit
 * - Create store in transaction, with its OWNER staff row and finance settings
 * - Create its draft storefront after commit (best-effort)
 *
 * Errors thrown by service are automatically mapped to HTTP responses:
 * - ZodError → 400 VALIDATION_ERROR (e.g. unsupported countryCode)
 * - SubscriptionInactiveError → 403
 * - StoreLimitReachedError → 403 SUBSCRIPTION_LIMIT_EXCEEDED, details
 *   { current, limit, upgradeRequired: true, requiredPlan } — the lowest plan
 *   that fits one more store (minPlanForStores): OPERATIONS from FREE/POS,
 *   ENTERPRISE from OPERATIONS at its 3-store cap
 * - financeSource.copy from a store outside the caller's business → 403 FORBIDDEN
 * - financeSource.country without countryCode → 400 VALIDATION_ERROR
 * - store name exists → 409
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
