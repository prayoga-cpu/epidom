import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getExchangeRate, refreshExchangeRate } from "@/lib/services/exchange-rate.service";

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

    return NextResponse.json({
      success: true,
      data: {
        fromCurrency: rateData.fromCurrency,
        toCurrency: rateData.toCurrency,
        rate: rateData.rate,
        fetchedAt: rateData.fetchedAt.toISOString(),
        expiresAt: rateData.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch exchange rate",
      },
      { status: 500 }
    );
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateData = await refreshExchangeRate();

    return NextResponse.json({
      success: true,
      message: "Exchange rate refreshed successfully",
      data: {
        fromCurrency: rateData.fromCurrency,
        toCurrency: rateData.toCurrency,
        rate: rateData.rate,
        fetchedAt: rateData.fetchedAt.toISOString(),
        expiresAt: rateData.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error refreshing exchange rate:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to refresh exchange rate",
      },
      { status: 500 }
    );
  }
}
