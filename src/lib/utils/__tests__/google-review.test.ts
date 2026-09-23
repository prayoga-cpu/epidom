import { describe, it, expect } from "vitest";
import {
  buildMapsUrl,
  buildReviewUrl,
  parseGoogleReviewInput,
  resolveGoogleLinks,
  type GoogleLinkSource,
} from "../google-review";

// The example Place ID from Google's own documentation.
const PLACE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4";
const REVIEW_URL = `https://search.google.com/local/writereview?placeid=${PLACE_ID}`;

describe("parseGoogleReviewInput", () => {
  it("builds the review link from a bare Place ID", () => {
    expect(parseGoogleReviewInput(PLACE_ID)).toEqual({
      ok: true,
      placeId: PLACE_ID,
      reviewUrl: REVIEW_URL,
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseGoogleReviewInput(`  ${PLACE_ID}\n`)).toMatchObject({ ok: true, placeId: PLACE_ID });
  });

  it("accepts the older GhIJ Place ID prefix", () => {
    const id = "GhIJQWDl0CIeQUARxks3icF8U8A";
    expect(parseGoogleReviewInput(id)).toMatchObject({ ok: true, placeId: id });
  });

  it("re-canonicalizes a writereview link and drops tracking params", () => {
    const pasted = `https://search.google.com/local/writereview?placeid=${PLACE_ID}&utm_source=qr&hl=fr`;
    expect(parseGoogleReviewInput(pasted)).toEqual({
      ok: true,
      placeId: PLACE_ID,
      reviewUrl: REVIEW_URL,
    });
  });

  it("extracts the Place ID from the reviews-list link", () => {
    const pasted = `https://search.google.com/local/reviews?placeid=${PLACE_ID}`;
    expect(parseGoogleReviewInput(pasted)).toMatchObject({ ok: true, placeId: PLACE_ID });
  });

  it("extracts the Place ID from a documented Maps search URL", () => {
    const pasted = `https://www.google.com/maps/search/?api=1&query=Warung+Budi&query_place_id=${PLACE_ID}`;
    expect(parseGoogleReviewInput(pasted)).toMatchObject({ ok: true, placeId: PLACE_ID });
  });

  it("extracts the Place ID from a ?q=place_id: Maps URL", () => {
    const pasted = `https://www.google.com/maps/place/?q=place_id:${PLACE_ID}`;
    expect(parseGoogleReviewInput(pasted)).toMatchObject({ ok: true, placeId: PLACE_ID });
  });

  it("accepts Business Profile's g.page short review link as-is, with no Place ID", () => {
    expect(parseGoogleReviewInput("https://g.page/r/CabcDEFghiJKLMn/review")).toEqual({
      ok: true,
      placeId: null,
      reviewUrl: "https://g.page/r/CabcDEFghiJKLMn/review",
    });
  });

  it("accepts the vanity g.page form and strips query, hash and trailing slash", () => {
    expect(parseGoogleReviewInput("https://g.page/warung-budi/review/?utm=x#top")).toMatchObject({
      ok: true,
      placeId: null,
      reviewUrl: "https://g.page/warung-budi/review",
    });
  });

  it("upgrades an http g.page link to https", () => {
    expect(parseGoogleReviewInput("http://g.page/r/Cabc/review")).toMatchObject({
      ok: true,
      reviewUrl: "https://g.page/r/Cabc/review",
    });
  });

  it("tolerates a pasted link with the scheme stripped", () => {
    expect(parseGoogleReviewInput("g.page/r/Cabc/review")).toMatchObject({
      ok: true,
      reviewUrl: "https://g.page/r/Cabc/review",
    });
  });

  it("accepts regional Google domains", () => {
    for (const host of ["google.fr", "google.co.id", "google.com.au", "maps.google.co.uk"]) {
      const pasted = `https://www.${host}/maps/search/?api=1&query=x&query_place_id=${PLACE_ID}`;
      expect(parseGoogleReviewInput(pasted)).toMatchObject({ ok: true, placeId: PLACE_ID });
    }
  });

  describe("a real Maps listing link is recognised but is not a review target", () => {
    it.each([
      "https://maps.app.goo.gl/AbCdEf123",
      "https://www.google.com/maps/place/Warung+Budi/@-8.65,115.21,17z/data=!4m6!3m5",
      "https://goo.gl/maps/AbCdEf",
      "https://g.page/r/CabcDEFghiJKLMn",
    ])("%s", (link) => {
      expect(parseGoogleReviewInput(link)).toEqual({ ok: false, reason: "mapsListing" });
    });
  });

  describe("rejects what can't be a Google link", () => {
    it.each([
      ["empty string", ""],
      ["whitespace only", "   "],
    ])("%s → empty", (_label, input) => {
      expect(parseGoogleReviewInput(input)).toEqual({ ok: false, reason: "empty" });
    });

    it.each([
      ["plain text", "my restaurant"],
      ["a too-short id", "ChIJshort"],
      ["a random long word", "internationalization"],
      ["a non-Google site", "https://example.com/reviews"],
      ["a non-Google site carrying a Place ID", `https://evil.example/?placeid=${PLACE_ID}`],
      ["a lookalike suffix", `https://notgoogle.com/?placeid=${PLACE_ID}`],
      ["a lookalike prefix", `https://google.com.evil.example/?placeid=${PLACE_ID}`],
      ["a non-Google 3-letter TLD", `https://google.xyz/?placeid=${PLACE_ID}`],
      ["a javascript: URL", "javascript:alert(1)"],
      ["an ftp: URL", "ftp://g.page/r/Cabc/review"],
      ["a legacy goo.gl non-maps link", "https://goo.gl/AbCdEf"],
      ["a Place ID with a space in it", `${PLACE_ID} extra`],
    ])("%s → invalid", (_label, input) => {
      expect(parseGoogleReviewInput(input)).toEqual({ ok: false, reason: "invalid" });
    });
  });
});

describe("buildMapsUrl", () => {
  it("uses Google's documented search URL with the Place ID", () => {
    const url = new URL(buildMapsUrl(PLACE_ID, "Warung Budi"));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("Warung Budi");
    expect(url.searchParams.get("query_place_id")).toBe(PLACE_ID);
  });

  it("URL-encodes the store name", () => {
    expect(buildMapsUrl(PLACE_ID, "Kopi & Roti")).toContain("query=Kopi+%26+Roti");
  });

  it("still sends the mandatory query when the name is blank", () => {
    expect(new URL(buildMapsUrl(PLACE_ID, "  ")).searchParams.get("query")).toBeTruthy();
  });
});

describe("buildReviewUrl", () => {
  it("points at Google's review form", () => {
    expect(buildReviewUrl(PLACE_ID)).toBe(REVIEW_URL);
  });
});

describe("resolveGoogleLinks", () => {
  const base: GoogleLinkSource = {
    displayName: "Warung Budi",
    googleMapsUrl: null,
    googlePlaceId: null,
    googleReviewUrl: null,
    googleReviewEnabled: true,
  };

  it("returns nothing for a storefront with no Google data", () => {
    expect(resolveGoogleLinks(base)).toEqual({ mapsUrl: null, reviewUrl: null });
  });

  it("derives the Maps link from the Place ID, so connecting reviews also links the map", () => {
    const { mapsUrl } = resolveGoogleLinks({
      ...base,
      googlePlaceId: PLACE_ID,
      googleReviewUrl: REVIEW_URL,
    });
    expect(mapsUrl).toBe(buildMapsUrl(PLACE_ID, "Warung Budi"));
  });

  it("prefers a hand-entered Maps link over the derived one", () => {
    const { mapsUrl } = resolveGoogleLinks({
      ...base,
      googleMapsUrl: "https://maps.app.goo.gl/manual",
      googlePlaceId: PLACE_ID,
    });
    expect(mapsUrl).toBe("https://maps.app.goo.gl/manual");
  });

  it("ignores a whitespace-only Maps link", () => {
    expect(resolveGoogleLinks({ ...base, googleMapsUrl: "   " }).mapsUrl).toBeNull();
  });

  it("uses the stored review link", () => {
    const { reviewUrl } = resolveGoogleLinks({
      ...base,
      googleReviewUrl: "https://g.page/r/Cabc/review",
    });
    expect(reviewUrl).toBe("https://g.page/r/Cabc/review");
  });

  it("falls back to building the review link from the Place ID", () => {
    expect(resolveGoogleLinks({ ...base, googlePlaceId: PLACE_ID }).reviewUrl).toBe(REVIEW_URL);
  });

  it("hides the review link while paused, but keeps the Maps link", () => {
    const result = resolveGoogleLinks({
      ...base,
      googlePlaceId: PLACE_ID,
      googleReviewUrl: REVIEW_URL,
      googleReviewEnabled: false,
    });
    expect(result.reviewUrl).toBeNull();
    expect(result.mapsUrl).toBe(buildMapsUrl(PLACE_ID, "Warung Budi"));
  });
});
