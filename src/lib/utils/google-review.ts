/**
 * Google review / Maps link helpers.
 *
 * Google has no API for posting a review on a customer's behalf — the only
 * supported route is a deep link into Google's own review form, where the
 * customer signs in with their Google account. So "connecting" a store means
 * capturing a Place ID (or Google's own short review link) and building links
 * from it. Nothing in here calls Google.
 *
 * Pure and isomorphic: the Back Office form uses it for instant feedback, and
 * the server re-runs it as the authority before anything is stored.
 */

const REVIEW_BASE = "https://search.google.com/local/writereview";

// Place IDs are opaque URL-safe strings; for businesses they start with
// "ChIJ" (or the older "GhIJ"). Anything else is far more likely a typo than a
// real ID — and Google's own g.page review link is always an escape hatch.
const PLACE_ID_RE = /^(?:ChIJ|GhIJ)[A-Za-z0-9_-]{16,}$/;

// google.com, google.fr, google.co.id, google.com.au, maps.google.com,
// search.google.com … Deliberately not "any 2–3 letter TLD": google.xyz and
// friends aren't Google's.
const GOOGLE_HOST_RE = /(?:^|\.)google\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2})$/;

export type GoogleLinkFailure =
  /** Nothing usable in the input. */
  | "empty"
  /** Not a Place ID, not a Google link. */
  | "invalid"
  /** A real Google Maps listing link — but it carries no review target. */
  | "mapsListing";

export type GoogleLinkParse =
  | {
      ok: true;
      /** Null for a g.page short link, which hides the Place ID. */
      placeId: string | null;
      /** Canonical link to Google's review form. */
      reviewUrl: string;
    }
  | { ok: false; reason: GoogleLinkFailure };

export function buildReviewUrl(placeId: string): string {
  return `${REVIEW_BASE}?placeid=${encodeURIComponent(placeId)}`;
}

/**
 * Google's documented Maps URL for a specific place. `query` is mandatory and
 * only used as a fallback when Google can't resolve the Place ID.
 */
export function buildMapsUrl(placeId: string, name: string): string {
  const params = new URLSearchParams({
    api: "1",
    query: name.trim() || "Google Maps",
    query_place_id: placeId,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function fromPlaceId(placeId: string): GoogleLinkParse {
  return { ok: true, placeId, reviewUrl: buildReviewUrl(placeId) };
}

/** Tolerates a pasted link with the scheme stripped ("g.page/r/abc/review"). */
function toUrl(input: string): URL | null {
  if (/\s/.test(input)) return null;
  try {
    return new URL(input);
  } catch {
    try {
      return new URL(`https://${input}`);
    } catch {
      return null;
    }
  }
}

function isGoogleHost(host: string, url: URL): boolean {
  if (GOOGLE_HOST_RE.test(host)) return true;
  if (host === "g.page" || host === "maps.app.goo.gl") return true;
  // Legacy Maps short links only — goo.gl in general is a retired shortener.
  return host === "goo.gl" && url.pathname.startsWith("/maps");
}

function extractPlaceId(url: URL): string | null {
  const candidates = [
    url.searchParams.get("placeid"),
    url.searchParams.get("place_id"),
    url.searchParams.get("query_place_id"),
    url.searchParams.get("q")?.match(/^place_id:(.+)$/)?.[1] ?? null,
  ];
  for (const c of candidates) {
    if (c && PLACE_ID_RE.test(c)) return c;
  }
  return null;
}

/**
 * Normalize whatever a merchant pastes — a Place ID, Google Business
 * Profile's "Get more reviews" link, or a Maps URL that embeds a Place ID —
 * into a canonical review link.
 */
export function parseGoogleReviewInput(raw: string): GoogleLinkParse {
  const input = raw.trim();
  if (!input) return { ok: false, reason: "empty" };

  if (PLACE_ID_RE.test(input)) return fromPlaceId(input);

  const url = toUrl(input);
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) {
    return { ok: false, reason: "invalid" };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!isGoogleHost(host, url)) return { ok: false, reason: "invalid" };

  const embedded = extractPlaceId(url);
  if (embedded) return fromPlaceId(embedded);

  // Business Profile's short review link: g.page/r/<code>/review or
  // g.page/<vanity>/review. Kept as-is (minus query/hash) since the Place ID
  // isn't recoverable from it. Always https.
  if (host === "g.page" && /^\/.+\/review\/?$/.test(url.pathname)) {
    return {
      ok: true,
      placeId: null,
      reviewUrl: `https://g.page${url.pathname.replace(/\/$/, "")}`,
    };
  }

  // A genuine Google link (maps.app.goo.gl/…, google.com/maps/place/…, the
  // g.page profile page) — useful as a Maps link, useless as a review target.
  return { ok: false, reason: "mapsListing" };
}

export interface GoogleLinkSource {
  displayName: string;
  googleMapsUrl: string | null;
  googlePlaceId: string | null;
  googleReviewUrl: string | null;
  googleReviewEnabled: boolean;
}

/**
 * What the public storefront should link to.
 *
 * - `mapsUrl`: a hand-entered Maps link wins; otherwise it is derived from the
 *   Place ID, so connecting Google Reviews also puts the store on the map
 *   without a second field to fill in. Independent of the review switch.
 * - `reviewUrl`: null while the prompts are paused or nothing is connected.
 */
export function resolveGoogleLinks(source: GoogleLinkSource): {
  mapsUrl: string | null;
  reviewUrl: string | null;
} {
  const mapsUrl =
    source.googleMapsUrl?.trim() ||
    (source.googlePlaceId ? buildMapsUrl(source.googlePlaceId, source.displayName) : null);

  const reviewUrl = source.googleReviewEnabled
    ? source.googleReviewUrl ||
      (source.googlePlaceId ? buildReviewUrl(source.googlePlaceId) : null)
    : null;

  return { mapsUrl, reviewUrl };
}
