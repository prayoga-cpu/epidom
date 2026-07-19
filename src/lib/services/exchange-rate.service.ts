import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Exchange Rate Service
 *
 * Fetches and caches exchange rates for arbitrary currency pairs from
 * exchangerate-api.io. Rates are cached per pair for 6 hours to minimize
 * API calls against the free-tier quota (1,500 requests/month).
 */

const EXCHANGE_RATE_API_URL =
  process.env.EXCHANGE_RATE_API_URL || "https://v6.exchangerate-api.com/v6";
const API_KEY = process.env.EXCHANGE_RATE_API_KEY || ""; // Free tier: 1,500 requests/month
const CACHE_DURATION_HOURS = 6; // Cache rates for 6 hours
const DEFAULT_BASE_CURRENCY = "EUR";
const DEFAULT_TARGET_CURRENCY = "USD";

export interface ExchangeRateData {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  fetchedAt: Date;
  expiresAt: Date;
}

function freshExpiry(): Date {
  return new Date(Date.now() + CACHE_DURATION_HOURS * 60 * 60 * 1000);
}

/**
 * Get the current exchange rate for a currency pair.
 * Returns cached rate if available and not expired, otherwise fetches a
 * fresh rate from the API and caches it. Identical currencies always
 * short-circuit to a rate of 1 with no API call.
 */
export async function getExchangeRate(
  from: string = DEFAULT_BASE_CURRENCY,
  to: string = DEFAULT_TARGET_CURRENCY
): Promise<ExchangeRateData> {
  if (from === to) {
    return {
      fromCurrency: from,
      toCurrency: to,
      rate: 1,
      fetchedAt: new Date(),
      expiresAt: freshExpiry(),
    };
  }

  try {
    const cachedRate = await getCachedExchangeRate(from, to);

    if (cachedRate && new Date() < cachedRate.expiresAt) {
      logger.info("Using cached exchange rate", { from, to, rate: cachedRate.rate });
      return {
        fromCurrency: cachedRate.fromCurrency,
        toCurrency: cachedRate.toCurrency,
        rate: Number(cachedRate.rate),
        fetchedAt: cachedRate.fetchedAt,
        expiresAt: cachedRate.expiresAt,
      };
    }

    // Fetch fresh rate from API
    logger.info("Fetching fresh exchange rate from API", { from, to });
    const freshRate = await fetchExchangeRateFromAPI(from, to);
    // Cache the new rate
    await cacheExchangeRate(freshRate);
    return freshRate;
  } catch (error) {
    logger.error("Error getting exchange rate", { from, to, error });

    // If API fails, try to return expired cached rate as fallback
    const cachedRate = await getCachedExchangeRate(from, to);
    if (cachedRate) {
      logger.warn("Using expired cached rate as fallback", { from, to, rate: cachedRate.rate });
      return {
        fromCurrency: cachedRate.fromCurrency,
        toCurrency: cachedRate.toCurrency,
        rate: Number(cachedRate.rate),
        fetchedAt: cachedRate.fetchedAt,
        expiresAt: cachedRate.expiresAt,
      };
    }

    // No cached data has ever existed for this pair — fall back to rate 1
    // (no conversion) rather than inventing a cross-currency multiplier.
    // Showing the raw stored number is a recoverable, honest failure mode;
    // a fabricated rate could silently mis-price a POS sale.
    logger.warn("No rate available for pair, falling back to 1:1", { from, to });
    return {
      fromCurrency: from,
      toCurrency: to,
      rate: 1,
      fetchedAt: new Date(),
      expiresAt: freshExpiry(),
    };
  }
}

/**
 * Fetch exchange rate from exchangerate-api.io
 */
async function fetchExchangeRateFromAPI(from: string, to: string): Promise<ExchangeRateData> {
  if (!API_KEY) {
    throw new Error("EXCHANGE_RATE_API_KEY environment variable is not set");
  }

  const url = `${EXCHANGE_RATE_API_URL}/${API_KEY}/pair/${from}/${to}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Exchange rate API returned status ${response.status}`);
  }

  const data = await response.json();
  if (data.result !== "success") {
    throw new Error(`Exchange rate API error: ${data["error-type"]}`);
  }

  const rate = data.conversion_rate;
  const now = new Date();

  return {
    fromCurrency: from,
    toCurrency: to,
    rate,
    fetchedAt: now,
    expiresAt: freshExpiry(),
  };
}

/**
 * Get cached exchange rate from database for a specific pair
 */
async function getCachedExchangeRate(from: string, to: string) {
  return await prisma.exchangeRate.findUnique({
    where: {
      fromCurrency_toCurrency: {
        fromCurrency: from,
        toCurrency: to,
      },
    },
  });
}

/**
 * Cache exchange rate in database
 */
async function cacheExchangeRate(rateData: ExchangeRateData) {
  const result = await prisma.exchangeRate.upsert({
    where: {
      fromCurrency_toCurrency: {
        fromCurrency: rateData.fromCurrency,
        toCurrency: rateData.toCurrency,
      },
    },
    update: {
      rate: rateData.rate,
      fetchedAt: rateData.fetchedAt,
      expiresAt: rateData.expiresAt,
      updatedAt: new Date(),
    },
    create: {
      fromCurrency: rateData.fromCurrency,
      toCurrency: rateData.toCurrency,
      rate: rateData.rate,
      fetchedAt: rateData.fetchedAt,
      expiresAt: rateData.expiresAt,
    },
  });
  return result;
}

/**
 * Convert a price using a given exchange rate
 */
export function convertPrice(price: number, exchangeRate: number): number {
  return price * exchangeRate;
}

/**
 * Manually refresh the exchange rate for a pair (admin function)
 */
export async function refreshExchangeRate(
  from: string = DEFAULT_BASE_CURRENCY,
  to: string = DEFAULT_TARGET_CURRENCY
): Promise<ExchangeRateData> {
  logger.info("Manually refreshing exchange rate", { from, to });
  const freshRate = await fetchExchangeRateFromAPI(from, to);
  await cacheExchangeRate(freshRate);
  return freshRate;
}

/**
 * Clean up expired exchange rates (maintenance function)
 */
export async function cleanupExpiredRates(): Promise<number> {
  const result = await prisma.exchangeRate.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Older than 7 days
      },
    },
  });

  logger.info(`Cleaned up ${result.count} expired exchange rates`);
  return result.count;
}
