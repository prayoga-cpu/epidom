import { describe, expect, it } from "vitest";
import {
  extrasFromInstagram,
  normalizeWhatsappNumber,
  slugFromInstagram,
  type InstagramPrefill,
} from "../instagram-prefill";

const prefill = (over: Partial<InstagramPrefill> = {}): InstagramPrefill => ({
  name: "Sunset Café",
  tagline: "Coffee & cake since 2019",
  slugCandidate: "sunset.cafe",
  instagramUrl: "https://instagram.com/sunset.cafe",
  whatsappNumber: "+62 812-3456-7890",
  themeColor: "#123456",
  logoUrl: "https://abc.public.blob.vercel-storage.com/logo.png",
  bio: "Coffee & cake since 2019",
  category: "Cafe",
  ...over,
});

describe("normalizeWhatsappNumber", () => {
  it.each([
    ["+62 812-3456-7890", "+6281234567890"],
    ["+33 (6) 12 34 56 78", "+33612345678"],
    ["0033 6 12 34 56 78", "+33612345678"],
    ["0812 3456 7890", null],
    ["call us", null],
    ["", null],
    [null, null],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeWhatsappNumber(raw)).toBe(expected);
  });
});

describe("extrasFromInstagram", () => {
  it("is empty without a prefill", () => {
    expect(extrasFromInstagram(null)).toEqual({});
  });

  it("keeps every field the server would accept", () => {
    expect(extrasFromInstagram(prefill())).toEqual({
      tagline: "Coffee & cake since 2019",
      logoUrl: "https://abc.public.blob.vercel-storage.com/logo.png",
      themeColor: "#123456",
      instagramUrl: "https://instagram.com/sunset.cafe",
      whatsappNumber: "+6281234567890",
    });
  });

  it("drops what the server would refuse instead of failing the step", () => {
    expect(
      extrasFromInstagram(
        prefill({
          tagline: "   ",
          logoUrl: "data:image/svg+xml;base64,AAAA",
          themeColor: "orange",
          instagramUrl: "not a url",
          whatsappNumber: "0812",
        })
      )
    ).toEqual({});
  });

  it("caps a long tagline at 150 characters", () => {
    const extras = extrasFromInstagram(prefill({ tagline: "x".repeat(200) }));
    expect(extras.tagline).toHaveLength(150);
  });
});

describe("slugFromInstagram", () => {
  it("turns the handle into a valid link", () => {
    expect(slugFromInstagram(prefill())).toBe("sunset-cafe");
  });

  it("returns null when there is nothing usable", () => {
    expect(slugFromInstagram(prefill({ slugCandidate: "ab" }))).toBeNull();
    expect(slugFromInstagram(prefill({ slugCandidate: null }))).toBeNull();
    expect(slugFromInstagram(null)).toBeNull();
  });
});
