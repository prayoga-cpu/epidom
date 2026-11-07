import { describe, it, expect } from "vitest";
import {
  CUSTOMER_DISPLAY_DEFAULTS,
  CUSTOMER_DISPLAY_MAX_BANNERS,
  customerDisplaySettingsSchema,
  parseStoredBanners,
} from "../customer-display.schemas";

const OWN = "https://abc.public.blob.vercel-storage.com/users/u1/images/1-a.png";
const banner = (over: Record<string, unknown> = {}) => ({
  id: "b1",
  imageUrl: OWN,
  label: "Promo",
  active: true,
  startDate: null,
  endDate: null,
  days: [],
  startTime: null,
  endTime: null,
  ...over,
});
const parse = (over: Record<string, unknown>) =>
  customerDisplaySettingsSchema.safeParse({ ...CUSTOMER_DISPLAY_DEFAULTS, ...over });

describe("customerDisplaySettingsSchema", () => {
  it("accepts the defaults (what a store with no row gets)", () => {
    expect(parse({}).success).toBe(true);
  });

  it("only takes images from our own upload hosts", () => {
    expect(parse({ backgroundImageUrl: OWN }).success).toBe(true);
    expect(parse({ backgroundImageUrl: "https://evil.example/x.png" }).success).toBe(false);
    expect(parse({ banners: [banner({ imageUrl: "http://x.public.blob.vercel-storage.com/a.png" })] }).success).toBe(false);
  });

  it("rejects an end date before the start date, and a half-set daily window", () => {
    expect(parse({ banners: [banner({ startDate: "2026-11-10", endDate: "2026-11-01" })] }).success).toBe(false);
    expect(parse({ banners: [banner({ startTime: "07:00", endTime: null })] }).success).toBe(false);
    expect(parse({ banners: [banner({ startTime: "07:00", endTime: "11:00", days: [1, 5] })] }).success).toBe(true);
  });

  it("caps the banner count and the timings", () => {
    const many = Array.from({ length: CUSTOMER_DISPLAY_MAX_BANNERS + 1 }, (_, i) => banner({ id: `b${i}` }));
    expect(parse({ banners: many }).success).toBe(false);
    expect(parse({ slideSeconds: 2 }).success).toBe(false);
    expect(parse({ thankYouSeconds: 61 }).success).toBe(false);
    expect(parse({ backgroundDim: 95 }).success).toBe(false);
  });

  it("rejects an option it doesn't know", () => {
    expect(parse({ backgroundStyle: "VIDEO" }).success).toBe(false);
    expect(parse({ themeColor: "red" }).success).toBe(false);
  });
});

describe("parseStoredBanners", () => {
  it("drops entries that no longer pass instead of failing the whole screen", () => {
    expect(parseStoredBanners([banner(), { id: "broken" }, banner({ id: "b2" })]).map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(parseStoredBanners(null)).toEqual([]);
    expect(parseStoredBanners({})).toEqual([]);
  });
});
