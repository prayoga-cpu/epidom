/**
 * POST /api/stores/[id]/customers/[customerId]/points — manual loyalty-points adjustment.
 *
 * Owner / manager only. Writes a LoyaltyEntry(ADJUST) and moves Customer.points
 * in one transaction; the balance can never go negative (a 400 pinned to the
 * `points` field). Signed body: +N grants, -N removes.
 */
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { customerService } from "@/lib/services/customer.service";
import { adjustPointsSchema } from "@/lib/validation/customers.schemas";
import { readJsonBody } from "@/lib/utils/read-json-body";
import { createSuccessResponse } from "@/types/api/responses";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async (request, { storeId, params }) => {
    const denied = await requireManagerOrOwnerApi(storeId!);
    if (denied) return denied;

    const input = adjustPointsSchema.parse(await readJsonBody(request));
    const customer = await customerService.adjustPoints(storeId!, params.customerId, input);
    return NextResponse.json(createSuccessResponse(customer));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/customers/[customerId]/points",
    requireStoreAuth: true,
  }
);
