/**
 * @file api/exchange-rates/route.ts
 * @description Exchange Rates API Endpoint
 * Manages currency exchange rates retrieval and refreshing.
 */

import { NextResponse } from "next/server";
import { getExchangeRate, refreshExchangeRate } from "@/lib/services/exchange-rate.service";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

const CURRENCY_CODE_RE = /^[A-Z]{3}$/;

/** Only accept well-formed 3-letter codes — anything else falls back to the caller's default. */
function parseCurrencyParam(value: string | null): string | undefined {
  if (value && CURRENCY_CODE_RE.test(value)) return value;
  return undefined;
}

/**
 * GET /api/exchange-rates?from=IDR&to=GBP
 *
 * Retrieves the current cached exchange rate for a currency pair (defaults
 * to EUR/USD if omitted). This endpoint is optimized for speed and relies
 * on service-layer caching.
 *
 * @returns {Promise<NextResponse>} Exchange rate data including expiration
 */
export async function GET(request: Request) {
  try {
    // Note: Public access allowed for frontend pricing display
    // If strict auth is needed later, wrap with withApiHandler

    const { searchParams } = new URL(request.url);
    const from = parseCurrencyParam(searchParams.get("from"));
    const to = parseCurrencyParam(searchParams.get("to"));

    const rateData = await getExchangeRate(from, to);

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
    const { searchParams } = new URL(request.url);
    const from = parseCurrencyParam(searchParams.get("from"));
    const to = parseCurrencyParam(searchParams.get("to"));
    const rateData = await refreshExchangeRate(from, to);

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
