/**
 * GET   /api/stores/[id]/customers/[customerId] — detail: last 20 orders + last 30 loyalty entries.
 * PATCH /api/stores/[id]/customers/[customerId] — edit name / phone / email / notes (manager or owner).
 *
 * Back Office only: neither is on the staff-account allow-list
 * (staff-principal-policy.ts), and PATCH additionally refuses a cashier PIN
 * persona on the owner's own device via requireManagerOrOwnerApi.
 */
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { customerService } from "@/lib/services/customer.service";
import { updateCustomerSchema } from "@/lib/validation/customers.schemas";
import { readJsonBody } from "@/lib/utils/read-json-body";
import { createSuccessResponse } from "@/types/api/responses";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_request, { storeId, params }) => {
    const customer = await customerService.getDetail(storeId!, params.customerId);
    return NextResponse.json(createSuccessResponse(customer));
  },
  { rateLimitEndpoint: "/api/stores/[id]/customers/[customerId]", requireStoreAuth: true }
);

export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const denied = await requireManagerOrOwnerApi(storeId!);
    if (denied) return denied;

    const input = updateCustomerSchema.parse(await readJsonBody(request));
    const customer = await customerService.update(storeId!, params.customerId, input);
    return NextResponse.json(createSuccessResponse(customer));
  },
  { rateLimitEndpoint: "/api/stores/[id]/customers/[customerId]", requireStoreAuth: true }
);
