import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// var (not const/let) avoids TDZ when vi.mock factory is hoisted above declarations.
var prismaMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    exchangeRate: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
  return { prisma: prismaMock };
});

// The service reads EXCHANGE_RATE_API_KEY into a module-level const at
// import time. Static `import` declarations are hoisted above all other
// top-level code (including a preceding `process.env` assignment), so the
// env var must be set before a *dynamic* import triggers module evaluation.
let getExchangeRate: typeof import("@/lib/services/exchange-rate.service").getExchangeRate;

beforeAll(async () => {
  process.env.EXCHANGE_RATE_API_KEY = "test-key";
  ({ getExchangeRate } = await import("@/lib/services/exchange-rate.service"));
});

describe("getExchangeRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("short-circuits to rate 1 when from === to, without touching the cache or API", async () => {
    const result = await getExchangeRate("IDR", "IDR");
    expect(result.rate).toBe(1);
    expect(prismaMock.exchangeRate.findUnique).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a non-expired cached rate for an arbitrary pair without calling the API", async () => {
    prismaMock.exchangeRate.findUnique.mockResolvedValue({
      fromCurrency: "IDR",
      toCurrency: "GBP",
      rate: 0.00005,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const result = await getExchangeRate("IDR", "GBP");
    expect(result.rate).toBe(0.00005);
    expect(result.fromCurrency).toBe("IDR");
    expect(result.toCurrency).toBe("GBP");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches and caches a fresh rate for a pair with no valid cache", async () => {
    prismaMock.exchangeRate.findUnique.mockResolvedValue(null);
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ result: "success", conversion_rate: 0.006 }),
    });

    const result = await getExchangeRate("IDR", "THB");
    expect(result.rate).toBe(0.006);
    expect(result.fromCurrency).toBe("IDR");
    expect(result.toCurrency).toBe("THB");
    expect(prismaMock.exchangeRate.upsert).toHaveBeenCalled();
  });

  it("falls back to rate 1 (no fabricated conversion) when there is no cache and the API fails", async () => {
    prismaMock.exchangeRate.findUnique.mockResolvedValue(null);
    (fetch as any).mockRejectedValue(new Error("network down"));

    const result = await getExchangeRate("IDR", "MYR");
    expect(result.rate).toBe(1);
    expect(result.fromCurrency).toBe("IDR");
    expect(result.toCurrency).toBe("MYR");
  });
});
