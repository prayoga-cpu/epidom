/**
 * The links a partner shares. A referral link only counts on a landing page
 * (REFERRAL_LANDING_PATHS in src/lib/attribution/cookies.ts): the sign-up page
 * or the home page. Sales pages are credited to their owner, so a `?ref=` on
 * one is ignored.
 */

export type ReferralLanding = "REGISTER" | "HOME";

/** Channels a partner can tag a link with, so they see which one brings sign-ups. */
export const REFERRAL_CHANNELS = ["whatsapp", "instagram", "facebook", "tiktok"] as const;
export type ReferralChannel = (typeof REFERRAL_CHANNELS)[number];

export function referralLink(
  origin: string,
  code: string,
  landing: ReferralLanding,
  channel?: ReferralChannel
): string {
  const url = new URL(landing === "HOME" ? "/" : "/register", origin);
  url.searchParams.set("ref", code);
  if (channel) {
    url.searchParams.set("utm_source", channel);
    url.searchParams.set("utm_medium", "referral");
  }
  return url.toString();
}

/** A sales page in each language: French is unprefixed, like the marketing site. */
export function salesPageLinks(
  origin: string,
  page: string
): { locale: "fr" | "en" | "id"; url: string }[] {
  return [
    { locale: "fr", url: new URL(`/${page}`, origin).toString() },
    { locale: "en", url: new URL(`/en/${page}`, origin).toString() },
    { locale: "id", url: new URL(`/id/${page}`, origin).toString() },
  ];
}

/** wa.me share link with a message and the URL. */
export function whatsappShareLink(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
}
