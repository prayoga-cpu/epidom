/**
 * @file api/exchange-rates/route.ts
 * @description Exchange Rates API Endpoint
 * Manages currency exchange rates retrieval and refreshing.
 */

import { NextResponse } from "next/server";
import { getExchangeRate, refreshExchangeRate } from "@/lib/services/exchange-rate.service";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/exchange-rates
 *
 * Retrieves the current cached exchange rate (EUR to USD).
 * This endpoint is optimized for speed and relies on service-layer caching.
 *
 * @returns {Promise<NextResponse>} Exchange rate data including expiration
 */
export async function GET() {
  try {
    // Note: Public access allowed for frontend pricing display
    // If strict auth is needed later, wrap with withApiHandler

    const rateData = await getExchangeRate();

    return NextResponse.json(
      createSuccessResponse({
        fromCurrency: rateData.fromCurrency,
        toCurrency: rateData.toCurrency,
        rate: rateData.rate,
        fetchedAt: rateData.fetchedAt.toISOString(),
        expiresAt: rateData.expiresAt.toISOString(),
      })
    );
  } catch (error) {
    // Fallback error handling since we're not using withApiHandler here (public route)
    console.error("[Exchange Rates] GET Failed:", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Failed to fetch exchange rates"),
      { status: 500 }
    );
  }
}

/**
 * POST /api/exchange-rates/refresh
 *
 * Manually forces a refresh of the exchange rate from the external provider.
 *
 * Security: Authenticated Users Only.
 * Rate Limit: Strict limit to prevent abuse of external API quota.
 */
export const POST = withApiHandler(
  async (request, { userId }) => {


    const rateData = await refreshExchangeRate();

    return NextResponse.json(
      createSuccessResponse({
        message: "Exchange rate refreshed successfully",
        fromCurrency: rateData.fromCurrency,
        toCurrency: rateData.toCurrency,
        rate: rateData.rate,
        fetchedAt: rateData.fetchedAt.toISOString(),
        expiresAt: rateData.expiresAt.toISOString(),
      })
    );
  },
  {
    // Very strict rate limit for checking/refreshing external API
    rateLimitEndpoint: "/api/exchange-rates/refresh",
  }
);
