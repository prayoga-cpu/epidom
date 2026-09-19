/**
 * GET  /api/stores/[id]/customers — search / list (cursor-paginated), optional store-wide summary.
 * POST /api/stores/[id]/customers — create a customer (phone normalised, unique per store).
 *
 * POS-tier: a cashier searches and adds customers from the cart. The Back
 * Office Customers page reads the same list with `includeSummary=1`. Existing
 * sibling `customers/analytics` (the dashboard card, grouped by order phone) is a
 * different thing and is untouched.
 *
 * lifetimeSpend / orderCount / lastOrderAt on every row are aggregated from
 * Order for the returned page on each request — see customer.repository.ts.
 */
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { customerService } from "@/lib/services/customer.service";
import { createCustomerSchema, customerListQuerySchema } from "@/lib/validation/customers.schemas";
import { readJsonBody } from "@/lib/utils/read-json-body";
import { createSuccessResponse } from "@/types/api/responses";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const query = customerListQuerySchema.parse({
      q: searchParams.get("q") || undefined,
      limit: searchParams.get("limit") || undefined,
      cursor: searchParams.get("cursor") || undefined,
      sort: searchParams.get("sort") || undefined,
      includeSummary: searchParams.get("includeSummary") || undefined,
    });

    const result = await customerService.list(storeId!, query);
    return NextResponse.json(createSuccessResponse(result));
  },
  { rateLimitEndpoint: "/api/stores/[id]/customers", requireStoreAuth: true }
);

export const POST = withApiHandler(
  async (request, { storeId }) => {
    const input = createCustomerSchema.parse(await readJsonBody(request));
    const customer = await customerService.create(storeId!, input);
    return NextResponse.json(createSuccessResponse(customer), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/customers", requireStoreAuth: true }
);
