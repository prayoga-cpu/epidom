/**
 * POST /api/stores/[id]/fiscal/verify
 *
 * Re-checks the whole journal from its records (src/lib/fiscal/verify.ts):
 * hashes, links, signatures, perpetual totals, closures and archives.
 * Read-only; POST because it is an action the owner runs, and heavy.
 */
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse } from "@/types/api/responses";
import { verifyFiscalJournal } from "@/lib/fiscal/verify";
import { requireFiscalAccessApi } from "@/lib/fiscal/summary";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async (_request, { storeId }) => {
    const gate = await requireFiscalAccessApi(storeId!);
    if (gate) return gate;
    return NextResponse.json(createSuccessResponse(await verifyFiscalJournal(storeId!)));
  },
  { rateLimitEndpoint: "/api/stores/[id]/fiscal/verify", requireStoreAuth: true }
);
