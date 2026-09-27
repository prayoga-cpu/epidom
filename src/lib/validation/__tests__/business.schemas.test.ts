import { describe, it, expect } from "vitest";
import {
  createStoreSchema,
  updateStoreSchema,
  updateBusinessSchema,
  createBusinessSchema,
  storeFinanceSourceSchema,
} from "../business.schemas";

describe("createStoreSchema — back-compat", () => {
  it("a body with only the store columns parses exactly as before", () => {
    const legacy = {
      name: "Kopi Kita",
      address: "Jl. Sudirman 1",
      city: "Jakarta",
      country: "Indonesia",
      phone: "+6281234567890",
      email: "hello@kopikita.id",
      image: "https://example.com/a.png",
    };

    expect(createStoreSchema.parse(legacy)).toEqual(legacy);
  });

  it("the name alone is still enough", () => {
    expect(createStoreSchema.parse({ name: "Kopi Kita" })).toEqual({ name: "Kopi Kita" });
  });

  it("still requires a name of at least 2 characters", () => {
    expect(createStoreSchema.safeParse({ name: "K" }).success).toBe(false);
    expect(createStoreSchema.safeParse({}).success).toBe(false);
  });

  it("accepts an empty optional email (the form's blank field) instead of blocking the form", () => {
    expect(createStoreSchema.safeParse({ name: "Kopi Kita", email: "" }).success).toBe(true);
    expect(createStoreSchema.safeParse({ name: "Kopi Kita", email: "not-an-email" }).success).toBe(
      false
    );
  });

  it("still supports .partial() (PATCH /api/stores/[id] parses with it)", () => {
    expect(createStoreSchema.partial().parse({ city: "Lyon" })).toEqual({ city: "Lyon" });
  });
});

describe("createStoreSchema — countryCode", () => {
  it("normalizes case and whitespace", () => {
    expect(createStoreSchema.parse({ name: "Chez Nous", countryCode: " fr " }).countryCode).toBe(
      "FR"
    );
  });

  it('accepts "ZZ" (a country not in the list)', () => {
    expect(createStoreSchema.safeParse({ name: "Chez Nous", countryCode: "ZZ" }).success).toBe(
      true
    );
  });

  it("rejects a code that isn't in COUNTRY_CODES", () => {
    expect(createStoreSchema.safeParse({ name: "Chez Nous", countryCode: "XX" }).success).toBe(
      false
    );
  });
});

describe("storeFinanceSourceSchema", () => {
  it("copy mode needs a source store id", () => {
    expect(storeFinanceSourceSchema.safeParse({ mode: "copy", storeId: "store_1" }).success).toBe(
      true
    );
    expect(storeFinanceSourceSchema.safeParse({ mode: "copy" }).success).toBe(false);
    expect(storeFinanceSourceSchema.safeParse({ mode: "copy", storeId: "  " }).success).toBe(false);
  });

  it("country mode takes an optional 3-letter currency, upper-cased", () => {
    expect(storeFinanceSourceSchema.parse({ mode: "country" })).toEqual({ mode: "country" });
    expect(storeFinanceSourceSchema.parse({ mode: "country", currency: "brl" })).toEqual({
      mode: "country",
      currency: "BRL",
    });
    expect(storeFinanceSourceSchema.safeParse({ mode: "country", currency: "EURO" }).success).toBe(
      false
    );
  });

  it("rejects an unknown mode", () => {
    expect(storeFinanceSourceSchema.safeParse({ mode: "business" }).success).toBe(false);
  });

  it("is optional on createStoreSchema", () => {
    const parsed = createStoreSchema.parse({
      name: "Chez Nous",
      countryCode: "FR",
      financeSource: { mode: "copy", storeId: "store_1" },
    });
    expect(parsed.financeSource).toEqual({ mode: "copy", storeId: "store_1" });
  });
});

describe("updateStoreSchema", () => {
  it("only knows Store columns (drops the create-only fields)", () => {
    expect(
      updateStoreSchema.parse({
        city: "Lyon",
        countryCode: "FR",
        financeSource: { mode: "country" },
      })
    ).toEqual({ city: "Lyon" });
  });
});

describe("business email", () => {
  it("accepts an empty email (a business with none, e.g. every wizard-created one)", () => {
    expect(
      updateBusinessSchema.safeParse({ name: "Le Comptoir", email: "", timezone: "Europe/Paris" })
        .success
    ).toBe(true);
    expect(createBusinessSchema.safeParse({ name: "Le Comptoir", email: "" }).success).toBe(true);
    expect(updateBusinessSchema.safeParse({ timezone: "Europe/Paris" }).success).toBe(true);
  });

  it("still rejects a malformed email and normalizes a real one", () => {
    expect(updateBusinessSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(updateBusinessSchema.parse({ email: " Contact@Comptoir.FR " }).email).toBe(
      "contact@comptoir.fr"
    );
  });
});

describe("business timezone", () => {
  it("accepts an IANA zone", () => {
    expect(updateBusinessSchema.parse({ timezone: "Europe/Paris" }).timezone).toBe("Europe/Paris");
    expect(updateBusinessSchema.parse({ timezone: " Asia/Makassar " }).timezone).toBe(
      "Asia/Makassar"
    );
    expect(updateBusinessSchema.parse({ timezone: "UTC" }).timezone).toBe("UTC");
  });

  it("refuses anything else, including an empty string", () => {
    expect(updateBusinessSchema.safeParse({ timezone: "Paris" }).success).toBe(false);
    expect(updateBusinessSchema.safeParse({ timezone: "Mars/Olympus_Mons" }).success).toBe(false);
    expect(updateBusinessSchema.safeParse({ timezone: "" }).success).toBe(false);
    expect(createBusinessSchema.safeParse({ name: "Biz", timezone: "nowhere" }).success).toBe(
      false
    );
  });

  it("leaves timezone out when it isn't sent (the Profile dialog's other edits never reset it)", () => {
    expect(updateBusinessSchema.parse({ name: "Biz" })).not.toHaveProperty("timezone");
  });
});
