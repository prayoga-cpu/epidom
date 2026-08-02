/**
 * GET/PATCH /api/stores/[id]/finance/settings
 *
 * A store's tax, service charge, and payment-processing fee configuration.
 * GET always resolves to a full settings object (config defaults merged in
 * for anything the store hasn't configured yet) — never a bare null.
 */
import { NextResponse } from "next/server";
import { getFinanceSettings, updateFinanceSettings } from "@/lib/services";
import { updateFinanceSettingsSchema } from "@/lib/validation/finance-settings.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const settings = await getFinanceSettings(storeId!);
    return NextResponse.json(createSuccessResponse(settings));
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/settings", requireStoreAuth: true }
);

export const PATCH = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = updateFinanceSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid settings data", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const settings = await updateFinanceSettings(storeId!, parsed.data);
    return NextResponse.json(createSuccessResponse(settings));
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/settings", requireStoreAuth: true }
);
