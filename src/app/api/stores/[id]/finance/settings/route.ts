/**
 * GET/PATCH /api/stores/[id]/finance/settings
 *
 * A store's tax, service charge, and payment-processing fee configuration.
 * GET always resolves to a full settings object (config defaults merged in
 * for anything the store hasn't configured yet) — never a bare null.
 */
import { NextResponse } from "next/server";
import { getFinanceSettings, updateFinanceSettings } from "@/lib/services";
import { updateStoreFinanceSettingsSchema } from "@/lib/validation/finance-settings.schemas";
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
    const parsed = updateStoreFinanceSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid settings data", parsed.error.flatten()),
        { status: 400 }
      );
    }

    try {
      const settings = await updateFinanceSettings(storeId!, parsed.data);
      return NextResponse.json(createSuccessResponse(settings));
    } catch (error) {
      // Domain conflict (e.g. editing fields while synced to business settings) —
      // distinct from validation errors, so it gets its own status/message.
      if (error instanceof Error && error.message.includes("synced")) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.CONFLICT, error.message), {
          status: 409,
        });
      }
      throw error;
    }
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/settings", requireStoreAuth: true }
);
