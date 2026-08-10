/**
 * GET/PATCH /api/user/business/finance-settings
 *
 * The shared, profile-wide fees & taxes configuration for the current user's
 * Business. Any Store with syncFinanceWithBusiness=true resolves its
 * effective settings from here (see getFinanceSettings in
 * finance-settings.service.ts). GET is also the fallback currency source
 * for dashboard pages with no store in context (e.g. /profile, /billing) —
 * see CurrencyProvider.
 */
import { NextResponse } from "next/server";
import {
  businessService,
  getBusinessFinanceSettings,
  updateBusinessFinanceSettings,
} from "@/lib/services";
import { updateFinanceSettingsSchema } from "@/lib/validation/finance-settings.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { userId }) => {
    const business = await businessService.getBusinessByUserId(userId);
    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
        { status: 404 }
      );
    }

    const settings = await getBusinessFinanceSettings(business.id);
    return NextResponse.json(createSuccessResponse(settings));
  },
  { rateLimitEndpoint: "/api/user/business/finance-settings" }
);

export const PATCH = withApiHandler(
  async (request, { userId }) => {
    const business = await businessService.getBusinessByUserId(userId);
    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateFinanceSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid settings data", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const settings = await updateBusinessFinanceSettings(business.id, parsed.data);
    return NextResponse.json(createSuccessResponse(settings));
  },
  { rateLimitEndpoint: "/api/user/business/finance-settings" }
);
