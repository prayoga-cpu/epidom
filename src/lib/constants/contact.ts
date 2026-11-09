import type { Locale } from "@/components/lang/i18n-provider";

/**
 * Real WhatsApp business numbers, one per market — France (primary) and
 * Indonesia (secondary), see docs/STRATEGY.md §3. Not a placeholder: do not
 * swap in a third number without confirming it's real first.
 */
export const WHATSAPP_NUMBERS = {
  fr: { market: "fr", number: "33781732386", label: "France" },
  id: { market: "id", number: "6285156329091", label: "Indonesia" },
} as const;

export function whatsappHref(number: string, text?: string): string {
  return `https://wa.me/${number}` + (text ? `?text=${encodeURIComponent(text)}` : "");
}

/**
 * Which WhatsApp number(s) to offer for a given site locale. fr/id pages
 * show their own market's number; en (worldwide) shows both — France first
 * since it's the primary market.
 */
export function getWhatsAppOptions(
  locale: Locale
): Array<{ market: "fr" | "id"; number: string; label: string }> {
  if (locale === "id") return [WHATSAPP_NUMBERS.id];
  if (locale === "en") return [WHATSAPP_NUMBERS.fr, WHATSAPP_NUMBERS.id];
  return [WHATSAPP_NUMBERS.fr];
}

/**
 * Epidom's public inboxes, the ONE place addresses are written down. Both are
 * Cloudflare Email Routing rules on epidom.fr that forward to a real inbox,
 * and each has its own job so mail lands with the person who can answer it:
 *
 *  - SUPPORT (support@epidom.fr): people already using Epidom, or about to pay:
 *    help, billing, refunds, account and legal requests, failed checkout,
 *    transactional emails, structured data.
 *  - CONTACT (contact@epidom.fr): everyone else: partnerships and suppliers,
 *    press, careers and general questions from visitors.
 *  - BUILD (consult@prionation.io): Prionation, the studio behind Epidom, for
 *    clients who want a NEW product built. Only "Build with us" uses it; never
 *    use a prionation.io address for Epidom customers.
 *
 * Tests assert no other file spells out a prionation.io address
 * (src/lib/constants/__tests__/support-email-guard.test.ts).
 */
export const SUPPORT_EMAIL_ADDRESSES = ["support@epidom.fr"] as const;
export const CONTACT_EMAIL_ADDRESSES = ["contact@epidom.fr"] as const;
export const BUILD_EMAIL_ADDRESSES = ["consult@prionation.io"] as const;

/** For places that accept exactly one address (JSON-LD contactPoint, headers). */
export const SUPPORT_EMAIL_PRIMARY: (typeof SUPPORT_EMAIL_ADDRESSES)[number] = "support@epidom.fr";

/** "a, b, c" — for visible text. */
export const SUPPORT_EMAIL_DISPLAY = SUPPORT_EMAIL_ADDRESSES.join(", ");
export const CONTACT_EMAIL_DISPLAY = CONTACT_EMAIL_ADDRESSES.join(", ");
export const BUILD_EMAIL_DISPLAY = BUILD_EMAIL_ADDRESSES.join(", ");

function mailtoFor(addresses: readonly string[], subject?: string): string {
  const base = `mailto:${addresses.join(",")}`;
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
}

/** `mailto:` href addressed to support, with an optional subject. */
export function supportMailto(subject?: string): string {
  return mailtoFor(SUPPORT_EMAIL_ADDRESSES, subject);
}
/** `mailto:` href for partnerships, press, careers and general questions. */
export function contactMailto(subject?: string): string {
  return mailtoFor(CONTACT_EMAIL_ADDRESSES, subject);
}
/** `mailto:` href for new-development clients (Prionation). */
export function buildMailto(subject?: string): string {
  return mailtoFor(BUILD_EMAIL_ADDRESSES, subject);
}

export const SUPPORT_MAILTO = supportMailto();
export const CONTACT_MAILTO = contactMailto();
export const BUILD_MAILTO = buildMailto();

/**
 * Prionation's "Meet us" booking page. The calendar lives on prionation.io;
 * Epidom only links to it (Build With Us, the site footer).
 */
export const PRIONATION_BOOKING_URL = "https://www.prionation.io/en#engage?tab=meet";
