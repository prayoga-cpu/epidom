import { describe, it, expect } from "vitest";
import {
  CUSTOMER_DISPLAY_DEFAULTS,
  type CustomerDisplayBanner,
} from "@/lib/validation/customer-display.schemas";
import type { CustomerDisplayConfig } from "@/types/api/customer-display";
import { isBannerLive, liveBannersOf, resolveCustomerDisplayLook } from "../customer-display-look";

const banner = (over: Partial<CustomerDisplayBanner> = {}): CustomerDisplayBanner => ({
  id: "b1",
  imageUrl: "https://x.public.blob.vercel-storage.com/users/u1/images/1-a.png",
  label: "Breakfast",
  active: true,
  startDate: null,
  endDate: null,
  days: [],
  startTime: null,
  endTime: null,
  ...over,
});

// Wednesday 12 November 2026, local time.
const at = (time: string, day = "2026-11-11") => new Date(`${day}T${time}:00`);

describe("isBannerLive", () => {
  it("shows an unscheduled, active banner all the time and never an inactive one", () => {
    expect(isBannerLive(banner(), at("03:00"))).toBe(true);
    expect(isBannerLive(banner({ active: false }), at("12:00"))).toBe(false);
  });

  it("treats the date range as inclusive on both ends", () => {
    const b = banner({ startDate: "2026-11-11", endDate: "2026-11-12" });
    expect(isBannerLive(b, at("00:00", "2026-11-10"))).toBe(false);
    expect(isBannerLive(b, at("00:00", "2026-11-11"))).toBe(true);
    expect(isBannerLive(b, at("23:59", "2026-11-12"))).toBe(true);
    expect(isBannerLive(b, at("00:00", "2026-11-13"))).toBe(false);
  });

  it("only runs on the chosen weekdays (0 = Sunday)", () => {
    const weekdays = banner({ days: [1, 2, 3, 4, 5] });
    expect(isBannerLive(weekdays, at("12:00", "2026-11-11"))).toBe(true); // Wednesday
    expect(isBannerLive(weekdays, at("12:00", "2026-11-15"))).toBe(false); // Sunday
  });

  it("uses a [start, end) daily window", () => {
    const breakfast = banner({ startTime: "07:00", endTime: "11:00" });
    expect(isBannerLive(breakfast, at("06:59"))).toBe(false);
    expect(isBannerLive(breakfast, at("07:00"))).toBe(true);
    expect(isBannerLive(breakfast, at("10:59"))).toBe(true);
    expect(isBannerLive(breakfast, at("11:00"))).toBe(false);
  });

  it("wraps a window that ends after midnight", () => {
    const late = banner({ startTime: "22:00", endTime: "02:00" });
    expect(isBannerLive(late, at("23:30"))).toBe(true);
    expect(isBannerLive(late, at("01:30"))).toBe(true);
    expect(isBannerLive(late, at("12:00"))).toBe(false);
  });

  it("reads a window whose start equals its end as all day", () => {
    expect(isBannerLive(banner({ startTime: "09:00", endTime: "09:00" }), at("15:00"))).toBe(true);
  });

  it("filters a list down to what is live, keeping the owner's order", () => {
    const list = [
      banner({ id: "a" }),
      banner({ id: "b", active: false }),
      banner({ id: "c", endDate: "2026-01-01" }),
      banner({ id: "d" }),
    ];
    expect(liveBannersOf(list, at("12:00")).map((b) => b.id)).toEqual(["a", "d"]);
  });
});

const config = (
  settings: Partial<CustomerDisplayConfig["settings"]> = {},
  branding: Partial<CustomerDisplayConfig["branding"]> = {}
): CustomerDisplayConfig => ({
  settings: { ...CUSTOMER_DISPLAY_DEFAULTS, ...settings },
  branding: {
    storeName: "Otium",
    storefrontLogoUrl: "https://x/logo.png",
    storefrontThemeColor: "#1F3A2A",
    storefrontFontStyle: "SANS",
    googleReviewUrl: null,
    instagramUrl: null,
    wifiName: null,
    wifiPassword: null,
    ...branding,
  },
  updatedAt: null,
});

describe("resolveCustomerDisplayLook", () => {
  it("defaults to the storefront's logo, colour gradient and font", () => {
    const look = resolveCustomerDisplayLook(config());
    expect(look.logoUrl).toBe("https://x/logo.png");
    expect(String(look.style.background)).toContain("linear-gradient");
    expect(look.style.fontFamily).toBe("var(--font-sans)");
    expect(look.backgroundImage).toBeNull();
  });

  it("prefers the display's own logo, colour and font", () => {
    const look = resolveCustomerDisplayLook(
      config({ logoUrl: "https://x/own.png", themeColor: "#112233", fontStyle: "SERIF" })
    );
    expect(look.logoUrl).toBe("https://x/own.png");
    expect(String(look.style.background)).toContain("#");
    expect(String(look.style.fontFamily)).toContain("Georgia");
  });

  it("draws a photo background only when a photo is set", () => {
    expect(resolveCustomerDisplayLook(config({ backgroundStyle: "IMAGE" })).backgroundImage).toBeNull();
    const look = resolveCustomerDisplayLook(
      config({
        backgroundStyle: "IMAGE",
        backgroundImageUrl: "https://x/bg.jpg",
        backgroundDim: 60,
        backgroundBlur: 8,
      })
    );
    expect(look.backgroundImage).toEqual({ url: "https://x/bg.jpg", blur: 8, dim: 60 });
  });

  it("follows a Mono storefront when the display has no font of its own", () => {
    const look = resolveCustomerDisplayLook(config({}, { storefrontFontStyle: "MONO" }));
    expect(String(look.style.fontFamily)).toContain("--font-geist-mono");
  });
});
