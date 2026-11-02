/**
 * GET /api/stores/[id]/fiscal
 *
 * The Fiscal journal page's data (src/lib/fiscal/summary.ts). Runs the due
 * maintenance first (late entries, closures, archives), so the page is never
 * behind while the hourly Inngest job isn't running; a maintenance failure
 * still returns the summary.
 */
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse } from "@/types/api/responses";
import { runFiscalMaintenance } from "@/lib/fiscal/maintenance";
import { getFiscalSummary, requireFiscalAccessApi } from "@/lib/fiscal/summary";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_request, { storeId }) => {
    const gate = await requireFiscalAccessApi(storeId!);
    if (gate) return gate;

    try {
      await runFiscalMaintenance(storeId!);
    } catch (err) {
      console.error("[FISCAL_GET] maintenance failed:", err);
    }

    return NextResponse.json(createSuccessResponse(await getFiscalSummary(storeId!)));
  },
  { rateLimitEndpoint: "/api/stores/[id]/fiscal", requireStoreAuth: true }
);
