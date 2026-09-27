import { describe, expect, it } from "vitest";
import { onboardingStorefrontStepSchema } from "@/lib/validation/onboarding.schemas";
import type { OnboardingState } from "@/lib/onboarding/contracts";
import { translatorFor } from "@/features/stores/shared/__tests__/helpers";
import {
  EPIDOM_GOLD_HEX,
  createStorefrontStepSchema,
  normalizeThemeColor,
  removedItemIds,
  storefrontDraftDefaults,
  storefrontPayload,
  storefrontStepDefaults,
} from "../storefront-step-schema";

const t = translatorFor("en");
const schema = createStorefrontStepSchema(t);

const state = (over: Partial<OnboardingState> = {}): OnboardingState => ({
  step: 2,
  completed: false,
  storeId: "s1",
  business: null,
  storefront: {
    slug: "mon-cafe",
    displayName: "Mon Café",
    tagline: "Hello",
    logoUrl: "https://abc.public.blob.vercel-storage.com/logo.png",
    themeColor: "#abc",
    instagramUrl: null,
    whatsappNumber: null,
    isPublished: false,
  },
  currency: "EUR",
  menuItems: [{ id: "m1", name: "Croissant", price: 1.5 }],
  goals: [],
  ...over,
});

const rows = (...items: Array<{ name: string; price?: number; id?: string }>) => [
  ...items,
  ...Array.from({ length: 3 - items.length }, () => ({ name: "", price: undefined })),
];

describe("storefrontStepDefaults", () => {
  it("pre-fills what was saved, padding to three rows", () => {
    const defaults = storefrontStepDefaults(state());
    expect(defaults.themeColor).toBe("#AABBCC");
    expect(defaults.tagline).toBe("Hello");
    expect(defaults.logoUrl).toBe("https://abc.public.blob.vercel-storage.com/logo.png");
    expect(defaults.menuItems).toEqual([
      { id: "m1", name: "Croissant", price: 1.5 },
      { id: undefined, name: "", price: undefined },
      { id: undefined, name: "", price: undefined },
    ]);
  });

  it("drops an old inline base64 logo", () => {
    const base = state();
    const defaults = storefrontStepDefaults({
      ...base,
      storefront: { ...base.storefront!, logoUrl: "data:image/svg+xml;base64,AAA" },
    });
    expect(defaults.logoUrl).toBeUndefined();
  });
});

describe("normalizeThemeColor", () => {
  it("expands, uppercases and falls back to the Epidom gold", () => {
    expect(normalizeThemeColor("#abc")).toBe("#AABBCC");
    expect(normalizeThemeColor("#ff6b35")).toBe("#FF6B35");
    expect(normalizeThemeColor("red")).toBe(EPIDOM_GOLD_HEX);
    expect(normalizeThemeColor(null)).toBe(EPIDOM_GOLD_HEX);
  });
});

describe("createStorefrontStepSchema", () => {
  const base = { logoUrl: undefined, themeColor: "#D9AE3B", tagline: "" };

  it("skips empty rows", () => {
    const result = schema.safeParse({ ...base, menuItems: rows() });
    expect(result.success).toBe(true);
  });

  it("needs a price for a named row", () => {
    const result = schema.safeParse({ ...base, menuItems: rows({ name: "Croissant" }) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["menuItems", 0, "price"],
      message: "Add a price for this dish.",
    });
  });

  it("needs a name for a priced row", () => {
    const result = schema.safeParse({ ...base, menuItems: rows({ name: " ", price: 3 }) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["menuItems", 0, "name"]);
  });

  it("builds a body the API accepts, keeping ids of resumed items", () => {
    const parsed = schema.parse({
      ...base,
      tagline: "  Fresh bread  ",
      menuItems: rows(
        { id: "m1", name: " Croissant ", price: 1.5 },
        { name: "Café crème", price: 0 }
      ),
    });
    const body = storefrontPayload(parsed);
    expect(body).toEqual({
      logoUrl: "",
      themeColor: "#D9AE3B",
      tagline: "Fresh bread",
      menuItems: [
        { id: "m1", name: "Croissant", price: 1.5 },
        { name: "Café crème", price: 0 },
      ],
    });
    expect(onboardingStorefrontStepSchema.safeParse(body).success).toBe(true);
  });

  it("sends the id of a saved row the owner cleared, so the server deletes that item", () => {
    const parsed = schema.parse({
      ...base,
      menuItems: [
        { id: "m1", name: "Croissant", price: 1.5 },
        { id: "m2", name: "  ", price: undefined },
        { id: undefined, name: "", price: undefined },
      ],
    });
    expect(removedItemIds(parsed.menuItems)).toEqual(["m2"]);
    const body = storefrontPayload(parsed);
    expect(body.menuItems).toEqual([{ id: "m1", name: "Croissant", price: 1.5 }]);
    expect(body.removedItemIds).toEqual(["m2"]);
    expect(onboardingStorefrontStepSchema.parse(body).removedItemIds).toEqual(["m2"]);
  });

  it("clearing every saved row still says which items to remove", () => {
    const parsed = schema.parse({
      ...base,
      menuItems: [
        { id: "m1", name: "", price: undefined },
        { id: "m2", name: "", price: undefined },
        { id: undefined, name: "", price: undefined },
      ],
    });
    const body = storefrontPayload(parsed);
    expect(body.menuItems).toEqual([]);
    expect(body.removedItemIds).toEqual(["m1", "m2"]);
  });

  it("leaves removedItemIds out when nothing was cleared", () => {
    const parsed = schema.parse({ ...base, menuItems: rows({ id: "m1", name: "A", price: 1 }) });
    expect(storefrontPayload(parsed)).not.toHaveProperty("removedItemIds");
  });
});

describe("storefrontDraftDefaults", () => {
  const empty = state({
    storefront: { ...state().storefront!, tagline: null, logoUrl: null, themeColor: "#D9AE3B" },
    menuItems: [],
  });

  it("without a draft, is the server's defaults", () => {
    expect(storefrontDraftDefaults(empty, null)).toEqual(storefrontStepDefaults(empty));
  });

  it("brings back what the owner typed before going Back", () => {
    const base = storefrontStepDefaults(empty);
    const values = {
      logoUrl: "https://abc.public.blob.vercel-storage.com/new.png",
      themeColor: "#1C7ED6",
      tagline: "Fresh bread",
      menuItems: [
        { id: undefined, name: "Croissant", price: 1.5 },
        { id: undefined, name: "", price: undefined },
        { id: undefined, name: "", price: undefined },
      ],
    };
    expect(storefrontDraftDefaults(empty, { base, values, currency: "EUR" })).toEqual(values);
  });

  it("an untouched field follows the server (step 1 may have saved an Instagram logo since)", () => {
    const base = storefrontStepDefaults(empty);
    const values = { ...base, tagline: "Typed here" };
    const next = state({
      storefront: {
        ...state().storefront!,
        tagline: "From Instagram",
        logoUrl: "https://abc.public.blob.vercel-storage.com/ig.png",
        themeColor: "#123456",
      },
      menuItems: [],
    });
    expect(storefrontDraftDefaults(next, { base, values, currency: "EUR" })).toMatchObject({
      tagline: "Typed here",
      logoUrl: "https://abc.public.blob.vercel-storage.com/ig.png",
      themeColor: "#123456",
    });
  });

  it("keeps a cleared saved row cleared, with its id", () => {
    const saved = state();
    const base = storefrontStepDefaults(saved);
    const values = {
      ...base,
      menuItems: [
        { id: "m1", name: "", price: undefined },
        ...base.menuItems.slice(1),
      ],
    };
    expect(
      storefrontDraftDefaults(saved, { base, values, currency: "EUR" }).menuItems[0]
    ).toEqual({ id: "m1", name: "", price: undefined });
  });

  it("drops a drafted price typed in another currency (the country changed on step 1)", () => {
    const base = storefrontStepDefaults(empty);
    const values = {
      ...base,
      menuItems: [
        { id: undefined, name: "Croissant", price: 4.5 },
        ...base.menuItems.slice(1),
      ],
    };
    const inRupiah = { ...empty, currency: "IDR" };
    expect(
      storefrontDraftDefaults(inRupiah, { base, values, currency: "EUR" }).menuItems[0]
    ).toEqual({ id: undefined, name: "Croissant", price: undefined });
  });
});
