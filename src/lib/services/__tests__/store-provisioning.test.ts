import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PAYMENT_METHODS_BY_MARKET } from "@/config/payment-fees.config";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("../storefront.service", () => ({ storefrontService: {} }));

import {
  StoreLimitReachedError,
  copyFinanceSettings,
  countryFinanceSettings,
  resolveStoreCountryCode,
  resolveStoreCountryColumn,
} from "../store-provisioning";

describe("resolveStoreCountryCode", () => {
  it("a sent code wins over the free text", () => {
    expect(resolveStoreCountryCode({ countryCode: "GB", country: "France" })).toBe("GB");
    expect(resolveStoreCountryCode({ countryCode: "ZZ", country: "France" })).toBe("ZZ");
  });

  it("without a code, reads the free text: English names, other spellings, codes, any case", () => {
    expect(resolveStoreCountryCode({ country: "France" })).toBe("FR");
    expect(resolveStoreCountryCode({ country: " indonésie " })).toBe("ID");
    expect(resolveStoreCountryCode({ country: "Belgique" })).toBe("BE");
    expect(resolveStoreCountryCode({ country: "fr" })).toBe("FR");
    expect(resolveStoreCountryCode({ countryCode: null, country: "Indonesia" })).toBe("ID");
    expect(resolveStoreCountryCode({ countryCode: "", country: "Indonesia" })).toBe("ID");
  });

  it("text that names no listed country, or nothing at all, gives undefined", () => {
    expect(resolveStoreCountryCode({ country: "Atlantis" })).toBeUndefined();
    expect(resolveStoreCountryCode({ country: "   " })).toBeUndefined();
    expect(resolveStoreCountryCode({})).toBeUndefined();
  });
});

describe("resolveStoreCountryColumn", () => {
  it("a listed country is stored as its English name, whatever free text came with it", () => {
    expect(resolveStoreCountryColumn({ countryCode: "ID", country: "Indonésie" })).toBe(
      "Indonesia"
    );
    expect(resolveStoreCountryColumn({ countryCode: "ci" })).toBe("Côte d'Ivoire");
  });

  it('"Other" (ZZ) or no code keeps the trimmed free text, or nothing', () => {
    expect(resolveStoreCountryColumn({ countryCode: "ZZ", country: "  Brasil " })).toBe("Brasil");
    expect(resolveStoreCountryColumn({ countryCode: "ZZ", country: "" })).toBeUndefined();
    expect(resolveStoreCountryColumn({ country: "Belgique" })).toBe("Belgique");
    expect(resolveStoreCountryColumn({})).toBeUndefined();
  });
});

describe("countryFinanceSettings", () => {
  it("Monaco uses the French payment market and methods, in EUR", () => {
    expect(countryFinanceSettings({ countryCode: "MC" })).toEqual({
      currency: "EUR",
      market: "FRANCE",
      enabledPaymentMethods: PAYMENT_METHODS_BY_MARKET.FRANCE,
    });
  });

  it("does not share the config array (a later mutation can't leak into another store)", () => {
    const data = countryFinanceSettings({ countryCode: "FR" });
    expect(data.enabledPaymentMethods).not.toBe(PAYMENT_METHODS_BY_MARKET.FRANCE);
  });

  it('"Other" without a chosen currency falls back to USD / INTERNATIONAL', () => {
    expect(countryFinanceSettings({ countryCode: "ZZ" })).toMatchObject({
      currency: "USD",
      market: "INTERNATIONAL",
    });
  });
});

describe("copyFinanceSettings", () => {
  const row = {
    id: "fin_1",
    storeId: "store_src",
    currency: "IDR",
    market: "INDONESIA" as const,
    enabledPaymentMethods: ["CASH" as const, "QRIS" as const],
    taxEnabled: true,
    taxRate: new Prisma.Decimal("0.1100"),
    taxLabel: "PPN",
    taxInclusive: false,
    serviceChargeEnabled: false,
    serviceChargeRate: new Prisma.Decimal("0"),
    processingFeeEnabled: true,
    processingFeeOverrides: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("drops identity and timestamps, keeps every config column", () => {
    const copied = copyFinanceSettings(row);

    expect(copied).not.toHaveProperty("id");
    expect(copied).not.toHaveProperty("storeId");
    expect(copied).not.toHaveProperty("createdAt");
    expect(copied).not.toHaveProperty("updatedAt");
    expect(copied).toMatchObject({
      currency: "IDR",
      market: "INDONESIA",
      enabledPaymentMethods: ["CASH", "QRIS"],
      taxEnabled: true,
      taxRate: new Prisma.Decimal("0.1100"),
      taxLabel: "PPN",
      taxInclusive: false,
      serviceChargeEnabled: false,
      serviceChargeRate: new Prisma.Decimal("0"),
      processingFeeEnabled: true,
    });
  });

  it("writes an absent override table as a JSON null (Prisma refuses a plain null for Json columns)", () => {
    expect(copyFinanceSettings(row).processingFeeOverrides).toBe(Prisma.JsonNull);
  });
});

describe("StoreLimitReachedError", () => {
  it("sends a one-store plan (FREE/POS) to Operations", () => {
    const error = new StoreLimitReachedError(1, 1);
    expect(error.message).toBe(
      "Your plan includes 1 store. Upgrade to the Operations plan to add more stores."
    );
    expect(error.details?.requiredPlan).toBe("OPERATIONS");
  });

  it("sends Operations at its 3-store cap to Enterprise", () => {
    const error = new StoreLimitReachedError(3, 3);
    expect(error.message).toBe(
      "Your plan includes 3 stores. More stores need the Enterprise plan: talk to us."
    );
    expect(error.details?.requiredPlan).toBe("ENTERPRISE");
  });
});
