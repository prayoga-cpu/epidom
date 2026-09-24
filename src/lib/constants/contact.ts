import type { Locale } from "@/components/lang/i18n-provider";

/**
 * Real WhatsApp business numbers, one per market — France (primary) and
 * Indonesia (secondary), see docs/STRATEGY.md §3. Not a placeholder: do not
 * swap in a third number without confirming it's real first.
 */
export const WHATSAPP_NUMBERS = {
  fr: { number: "33781732386", label: "France" },
  id: { number: "6285156329091", label: "Indonesia" },
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
): Array<{ number: string; label: string }> {
  if (locale === "id") return [WHATSAPP_NUMBERS.id];
  if (locale === "en") return [WHATSAPP_NUMBERS.fr, WHATSAPP_NUMBERS.id];
  return [WHATSAPP_NUMBERS.fr];
}

/**
 * The public support inbox — the ONE place these addresses are written down.
 * Today it is the Prionation studio's shared inbox (a mailto with several
 * recipients). Pages, transactional emails and structured data all read it from
 * here, so moving to a branded address (support@epidom.fr, say) is a one-line
 * change once that mailbox and its sending domain actually exist — until then,
 * pointing the site at an address that bounces would lose every message.
 */
export const SUPPORT_EMAIL_ADDRESSES = [
  "cro@prionation.io",
  "ceo@prionation.io",
  "consult@prionation.io",
] as const;

/** For places that accept exactly one address (JSON-LD contactPoint, headers). */
export const SUPPORT_EMAIL_PRIMARY: (typeof SUPPORT_EMAIL_ADDRESSES)[number] = "consult@prionation.io";

/** "a, b, c" — for visible text. */
export const SUPPORT_EMAIL_DISPLAY = SUPPORT_EMAIL_ADDRESSES.join(", ");

/** `mailto:` href addressed to every support recipient, with an optional subject. */
export function supportMailto(subject?: string): string {
  const base = `mailto:${SUPPORT_EMAIL_ADDRESSES.join(",")}`;
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
}

export const SUPPORT_MAILTO = supportMailto();

/**
 * Prionation's "Meet us" booking page. The calendar lives on prionation.io;
 * Epidom only links to it (Build With Us, the site footer).
 */
export const PRIONATION_BOOKING_URL = "https://www.prionation.io/en#engage?tab=meet";
