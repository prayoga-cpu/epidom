import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { businessService, getStoreOverviews } from "@/lib/services";
import { getLinkedStaffForUser } from "@/lib/auth/staff-link";
import { getActiveStaffSession } from "@/lib/staff-session";
import { createSuccessResponse } from "@/types/api/responses";

export const dynamic = "force-dynamic";

/**
 * GET /api/stores/overview
 *
 * What the Your Stores cards show beyond GET /api/stores: each store's
 * storefront branding (logo, cover, colour), slogan, currency and market, and
 * for the owner, all-time totals (revenue, customers, staff). One row per store
 * the account can see (StoreOverview[], newest first). The client matches rows
 * to cards by storeId.
 *
 * Only the Your Stores page calls this. GET /api/stores stays lean because the
 * store switchers fetch it on every page.
 *
 * Takes no input: the stores come from the session (the account's own business
 * plus its linked-staff store), never from the client. If a query param is ever
 * added, it needs a Zod schema.
 */
export const GET = withApiHandler(
  async (_request, { userId }) => {
    const [business, link, persona] = await Promise.all([
      businessService.getBusinessByUserId(userId),
      getLinkedStaffForUser(userId),
      getActiveStaffSession(),
    ]);

    // The store list is owner-level (nav-user hides "Back to stores" for a
    // staff persona). The API handler only restricts linked staff accounts on
    // store routes and does not enforce PIN personas, so this route checks for
    // itself: a non-OWNER PIN persona on the owner's device gets no totals.
    const includeTotals = !persona || persona.role === "OWNER";

    const overviews = await getStoreOverviews({
      businessId: business?.id ?? null,
      linkedStoreId: link?.storeId ?? null,
      includeTotals,
    });

    return NextResponse.json(createSuccessResponse(overviews));
  },
  {
    rateLimitEndpoint: "/api/stores/overview",
  }
);
