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
