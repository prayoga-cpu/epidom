import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: { findUnique: vi.fn() },
    businessFinanceSettings: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getFinanceSettings, resolveCurrencyAndMarket } from "../finance-settings.service";

const storeFindUnique = vi.mocked(prisma.store.findUnique) as unknown as ReturnType<typeof vi.fn>;
const businessFindUnique = vi.mocked(
  prisma.businessFinanceSettings.findUnique
) as unknown as ReturnType<typeof vi.fn>;

/** A full finance-settings row, as getFinanceSettings reads it. */
const financeRow = (currency: string, market: "INDONESIA" | "FRANCE" | "INTERNATIONAL") => ({
  currency,
  market,
  enabledPaymentMethods: ["CASH"],
  taxEnabled: false,
  taxRate: new Prisma.Decimal(0),
  taxLabel: null,
  taxInclusive: true,
  serviceChargeEnabled: false,
  serviceChargeRate: new Prisma.Decimal(0),
  processingFeeEnabled: true,
  processingFeeOverrides: null,
});

beforeEach(() => {
  storeFindUnique.mockReset();
  businessFindUnique.mockReset();
});

describe("resolveCurrencyAndMarket", () => {
  it("no row (or undefined): IDR / INDONESIA", () => {
    expect(resolveCurrencyAndMarket(null)).toEqual({ currency: "IDR", market: "INDONESIA" });
    expect(resolveCurrencyAndMarket(undefined)).toEqual({ currency: "IDR", market: "INDONESIA" });
  });

  it("a row passes through as is", () => {
    expect(resolveCurrencyAndMarket({ currency: "EUR", market: "FRANCE" })).toEqual({
      currency: "EUR",
      market: "FRANCE",
    });
  });
});

describe("getFinanceSettings currency/market (resolveRow now delegates to the helper)", () => {
  const store = (over: Record<string, unknown>) => ({
    businessId: "biz_1",
    syncFinanceWithBusiness: false,
    payLaterEnabled: false,
    financeSettings: null,
    ...over,
  });

  it("sync off: the store's own row", async () => {
    storeFindUnique.mockResolvedValue(store({ financeSettings: financeRow("EUR", "FRANCE") }));

    const settings = await getFinanceSettings("s1");

    expect(settings).toMatchObject({ currency: "EUR", market: "FRANCE", storeId: "s1" });
    expect(businessFindUnique).not.toHaveBeenCalled();
  });

  it("sync off with no row: IDR / INDONESIA", async () => {
    storeFindUnique.mockResolvedValue(store({}));

    expect(await getFinanceSettings("s1")).toMatchObject({ currency: "IDR", market: "INDONESIA" });
  });

  it("sync on: the business's row, not the store's", async () => {
    storeFindUnique.mockResolvedValue(
      store({ syncFinanceWithBusiness: true, financeSettings: financeRow("EUR", "FRANCE") })
    );
    businessFindUnique.mockResolvedValue(financeRow("USD", "INTERNATIONAL"));

    expect(await getFinanceSettings("s1")).toMatchObject({
      currency: "USD",
      market: "INTERNATIONAL",
      syncFinanceWithBusiness: true,
    });
  });

  it("sync on with no business row: IDR / INDONESIA", async () => {
    storeFindUnique.mockResolvedValue(store({ syncFinanceWithBusiness: true }));
    businessFindUnique.mockResolvedValue(null);

    expect(await getFinanceSettings("s1")).toMatchObject({ currency: "IDR", market: "INDONESIA" });
  });
});
