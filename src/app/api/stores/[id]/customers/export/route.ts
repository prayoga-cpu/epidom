/**
 * GET /api/stores/[id]/customers/export — CSV download of the customer list.
 *
 * Owner / manager only, and deliberately NOT on the staff-account allow-list:
 * the whole customer table (phones, e-mails, spend) is one click away, which is
 * not a cashier's job. `q` narrows it the same way the list search does.
 */
import { withApiHandler } from "@/lib/api-handler";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { customerService } from "@/lib/services/customer.service";
import { createCSVResponse } from "@/lib/utils/csv-export";
import { z } from "zod";

export const dynamic = "force-dynamic";

const exportQuerySchema = z.object({ q: z.string().trim().max(100).optional() });

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const denied = await requireManagerOrOwnerApi(storeId!);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const { q } = exportQuerySchema.parse({ q: searchParams.get("q") || undefined });

    const csv = await customerService.exportCsv(storeId!, q);
    return createCSVResponse(csv, "customers");
  },
  { rateLimitEndpoint: "/api/stores/[id]/customers/export", requireStoreAuth: true }
);
