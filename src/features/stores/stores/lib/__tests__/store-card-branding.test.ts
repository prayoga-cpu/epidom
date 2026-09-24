import { describe, it, expect } from "vitest";
import { getContrastingInk, getPremiumTheme } from "@/lib/utils/color";
import {
  DEFAULT_STORE_THEME_COLOR,
  isBlobHostedImage,
  resolveStoreCardBranding,
} from "../store-card-branding";

const store = { name: "Test Store", image: null as string | null };
const overview = (
  o: Partial<{ coverUrl: string | null; logoUrl: string | null; themeColor: string | null }>
) => ({
  coverUrl: null,
  logoUrl: null,
  themeColor: null,
  ...o,
});

describe("resolveStoreCardBranding — cover", () => {
  it("prefers the storefront cover over the Store Image", () => {
    const b = resolveStoreCardBranding(
      { ...store, image: "https://img.test/store.jpg" },
      overview({ coverUrl: "https://img.test/cover.jpg" })
    );
    expect(b.coverUrl).toBe("https://img.test/cover.jpg");
  });

  it("falls back to the Store Image when there is no storefront cover, or it is ''", () => {
    const withImage = { ...store, image: "https://img.test/store.jpg" };
    expect(resolveStoreCardBranding(withImage, overview({})).coverUrl).toBe(
      "https://img.test/store.jpg"
    );
    expect(resolveStoreCardBranding(withImage, overview({ coverUrl: "" })).coverUrl).toBe(
      "https://img.test/store.jpg"
    );
    // The overview hasn't arrived (or failed): the Store Image still shows.
    expect(resolveStoreCardBranding(withImage, null).coverUrl).toBe("https://img.test/store.jpg");
  });

  it("is null (the tinted placeholder) when neither exists, with '' counted as absent at each step", () => {
    expect(resolveStoreCardBranding(store, null).coverUrl).toBeNull();
    expect(
      resolveStoreCardBranding({ ...store, image: "" }, overview({ coverUrl: "" })).coverUrl
    ).toBeNull();
  });
});

describe("resolveStoreCardBranding — logo and initial", () => {
  it("uses the storefront logo, and null for a missing or '' one", () => {
    expect(
      resolveStoreCardBranding(store, overview({ logoUrl: "data:image/svg+xml;base64,AAA" }))
        .logoUrl
    ).toBe("data:image/svg+xml;base64,AAA");
    expect(resolveStoreCardBranding(store, overview({ logoUrl: "" })).logoUrl).toBeNull();
    expect(resolveStoreCardBranding(store, null).logoUrl).toBeNull();
  });

  it("takes the first letter of the trimmed name, upper-cased; a blank name gives '?'", () => {
    expect(resolveStoreCardBranding({ ...store, name: "  bakery" }, null).initial).toBe("B");
    expect(resolveStoreCardBranding({ ...store, name: "" }, null).initial).toBe("?");
    expect(resolveStoreCardBranding({ ...store, name: "   " }, null).initial).toBe("?");
  });

  it("keeps a character outside the BMP whole", () => {
    expect(resolveStoreCardBranding({ ...store, name: "🍜 Noodle Bar" }, null).initial).toBe("🍜");
  });
});

describe("resolveStoreCardBranding — colour", () => {
  it("uses the default theme colour, clamped, when there is no storefront row", () => {
    const b = resolveStoreCardBranding(store, null);
    expect(b.brand).toBe(getPremiumTheme(DEFAULT_STORE_THEME_COLOR));
    expect(b.ink).toBe(getContrastingInk(b.brand));
  });

  it("clamps an unclamped stored colour (onboarding can save #000000)", () => {
    const b = resolveStoreCardBranding(store, overview({ themeColor: "#000000" }));
    expect(b.brand).not.toBe("#000000");
    expect(b.brand).toBe(getPremiumTheme("#000000"));
    expect(b.ink).toBe("#FFFFFF");
  });

  it("picks dark ink on a pale brand colour", () => {
    const b = resolveStoreCardBranding(store, overview({ themeColor: "#FFE9A8" }));
    expect(b.ink).toBe(getContrastingInk(b.brand));
    expect(b.ink).toBe("#141210");
  });

  it("exposes exactly the two custom properties the card and chooser read", () => {
    const b = resolveStoreCardBranding(store, overview({ themeColor: "#2255AA" }));
    expect(b.brandStyle).toEqual({ "--store-brand": b.brand, "--store-brand-ink": b.ink });
  });
});

describe("isBlobHostedImage", () => {
  it("is true only for Vercel Blob URLs", () => {
    expect(isBlobHostedImage("https://abc.public.blob.vercel-storage.com/x.png")).toBe(true);
    expect(isBlobHostedImage("https://img.test/x.png")).toBe(false);
    expect(isBlobHostedImage("data:image/png;base64,AAA")).toBe(false);
  });
});
