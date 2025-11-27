import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getExchangeRate, refreshExchangeRate } from "@/lib/services/exchange-rate.service";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * GET /api/exchange-rates
 *
 * Get the current EUR to USD exchange rate
 * Returns cached rate if available and not expired
 *
 * @returns {Object} Exchange rate data
 */
export async function GET() {
  try {
    // Optional: Require authentication
    // Uncomment if you want only logged-in users to access rates
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

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
    return handleApiError(error, {
      endpoint: "GET /api/exchange-rates",
      context: {},
    });
  }
}

/**
 * POST /api/exchange-rates/refresh
 *
 * Manually refresh the exchange rate (admin only)
 * Forces a fresh fetch from the API regardless of cache
 *
 * @returns {Object} Fresh exchange rate data
 */
export async function POST() {
  try {
    // Require authentication for manual refresh
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

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
  } catch (error) {
    return handleApiError(error, {
      endpoint: "POST /api/exchange-rates",
      context: {},
    });
  }
}
