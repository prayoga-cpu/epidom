import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES, OTHER_COUNTRY_CODE } from "@/lib/onboarding/markets";
import {
  createStoreEssentialsSchema,
  storeEssentialsDefaultValues,
  storeEssentialsPayload,
  storeEssentialsSchema,
} from "../schema";
import { DICTS, translatorFor } from "./helpers";

/** First message per field — what react-hook-form's zodResolver shows. */
function errorsOf(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  const errors: Record<string, string> = {};
  for (const issue of result.error?.issues ?? []) {
    const path = issue.path.map(String).join(".");
    errors[path] ??= issue.message;
  }
  return errors;
}

describe("storeEssentialsSchema", () => {
  it("accepts the essentials and normalizes the country code", () => {
    const result = storeEssentialsSchema.safeParse({
      name: " Le Petit Four ",
      countryCode: "fr",
      city: "",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "Le Petit Four", countryCode: "FR", city: "" });
  });

  it("accepts Other country with a currency", () => {
    const result = storeEssentialsSchema.safeParse({
      name: "Chez Awa",
      countryCode: OTHER_COUNTRY_CODE,
      currency: "xaf",
      businessType: "homeKitchen",
    });
    expect(result.success).toBe(true);
    expect(result.data?.currency).toBe("XAF");
  });

  it("rejects bad values", () => {
    const result = storeEssentialsSchema.safeParse({
      name: "A",
      countryCode: "XX",
      city: "x".repeat(101),
      businessType: "spa",
      currency: "EURO",
    });
    expect(result.success).toBe(false);
    expect(Object.keys(errorsOf(result)).sort()).toEqual(
      ["businessType", "city", "countryCode", "currency", "name"].sort()
    );
  });
});

describe("createStoreEssentialsSchema", () => {
  it("has the same fields as the static schema", () => {
    const localized = createStoreEssentialsSchema(translatorFor("en"));
    expect(Object.keys(localized.shape).sort()).toEqual(
      Object.keys(storeEssentialsSchema.shape).sort()
    );
  });

  it("answers in French", () => {
    const schema = createStoreEssentialsSchema(translatorFor("fr"));
    expect(errorsOf(schema.safeParse({ name: "", countryCode: "" }))).toEqual({
      name: "Indiquez le nom de votre établissement.",
      countryCode: "Choisissez le pays de votre établissement.",
    });
    expect(errorsOf(schema.safeParse({ name: "A", countryCode: "FR" }))).toEqual({
      name: "Le nom doit comporter au moins 2 caractères.",
    });
    expect(
      errorsOf(
        schema.safeParse({ name: "x".repeat(101), countryCode: "FR", city: "y".repeat(101) })
      )
    ).toEqual({
      name: "Le nom ne peut pas dépasser 100 caractères.",
      city: "Le nom de la ville ne peut pas dépasser 100 caractères.",
    });
  });

  it("answers in Indonesian", () => {
    const schema = createStoreEssentialsSchema(translatorFor("id"));
    expect(
      errorsOf(schema.safeParse({ name: "Kopi Senja", countryCode: "ZZ", currency: "rp" }))
    ).toEqual({
      currency: "Pilih mata uang.",
    });
  });

  it("reads a cleared business type (null in the form) as no business type", () => {
    const schema = createStoreEssentialsSchema(translatorFor("en"));
    const cleared = schema.safeParse({ name: "Le Fournil", countryCode: "FR", businessType: null });
    expect(cleared.success).toBe(true);
    expect(cleared.data?.businessType).toBeUndefined();
    expect(storeEssentialsPayload(cleared.data!)).toEqual({ name: "Le Fournil", countryCode: "FR" });

    const picked = schema.safeParse({ name: "Le Fournil", countryCode: "FR", businessType: "bakery" });
    expect(picked.data?.businessType).toBe("bakery");
    expect(schema.safeParse({ name: "Le Fournil", countryCode: "FR" }).success).toBe(true);
    expect(
      schema.safeParse({ name: "Le Fournil", countryCode: "FR", businessType: "spa" }).success
    ).toBe(false);
  });

  it("can be extended with more fields", () => {
    const schema = createStoreEssentialsSchema(translatorFor("en")).extend({
      address: storeEssentialsSchema.shape.city,
    });
    expect(
      schema.safeParse({ name: "Corner Café", countryCode: "US", address: "1 Main St" }).success
    ).toBe(true);
  });
});

describe("storeEssentialsDefaultValues", () => {
  it("starts blank and takes overrides", () => {
    expect(storeEssentialsDefaultValues()).toEqual({
      name: "",
      countryCode: "",
      city: "",
      businessType: undefined,
      currency: undefined,
    });
    expect(storeEssentialsDefaultValues({ countryCode: "ID" }).countryCode).toBe("ID");
  });
});

describe("storeEssentialsPayload", () => {
  it("drops the currency for a listed country and an empty city", () => {
    expect(
      storeEssentialsPayload({ name: " Café ", countryCode: "fr", city: "  ", currency: "USD" })
    ).toEqual({ name: "Café", countryCode: "FR" });
  });

  it("keeps the currency for Other country", () => {
    expect(
      storeEssentialsPayload({
        name: "Chez Awa",
        countryCode: OTHER_COUNTRY_CODE,
        city: "Douala",
        businessType: "catering",
        currency: "xaf",
      })
    ).toEqual({
      name: "Chez Awa",
      countryCode: OTHER_COUNTRY_CODE,
      city: "Douala",
      businessType: "catering",
      currency: "XAF",
    });
  });
});

describe("storeEssentials strings", () => {
  function leafKeys(node: unknown, prefix = ""): string[] {
    if (typeof node === "string") return [prefix];
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
      leafKeys(value, prefix ? `${prefix}.${key}` : key)
    );
  }

  it("exist in all three languages with the same keys", () => {
    const enKeys = leafKeys(DICTS.en.storeEssentials).sort();
    expect(leafKeys(DICTS.fr.storeEssentials).sort()).toEqual(enKeys);
    expect(leafKeys(DICTS.id.storeEssentials).sort()).toEqual(enKeys);
    for (const locale of ["en", "fr", "id"] as const) {
      const t = translatorFor(locale);
      for (const key of enKeys) expect(t(`storeEssentials.${key}`).trim()).not.toBe("");
    }
  });

  it("names every business type", () => {
    for (const locale of ["en", "fr", "id"] as const) {
      const t = translatorFor(locale);
      for (const type of BUSINESS_TYPES) {
        const key = `storeEssentials.businessTypes.${type}`;
        expect(t(key)).not.toBe(key);
      }
    }
  });

  it("uses the requested city placeholders", () => {
    expect(DICTS.fr.storeEssentials.city.placeholder).toBe("ex. Lyon");
    expect(DICTS.id.storeEssentials.city.placeholder).toBe("mis. Denpasar");
    expect(DICTS.en.storeEssentials.city.placeholder).toBe("e.g. Austin");
  });
});
