/**
 * Shared WhatsApp phone/link helpers — used by both the server-side Fonnte
 * sender (notifications/providers/fonnte.ts) and the client-side "open
 * wa.me with a prefilled message" flow (no Fonnte account required).
 */

/**
 * WhatsApp's own accepted format: digits only, country code, no leading
 * zero/plus. Indonesian numbers are commonly typed with a local leading "0"
 * (e.g. "0812...") — converted to the "62..." country-code form here since
 * that's this app's primary market and the only conversion we can safely
 * guess. A number that already starts with a country code (no leading zero)
 * is passed through untouched.
 */
export function normalizeWhatsappPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

/** `https://wa.me/<phone>?text=<message>` — opens WhatsApp Web/app with the
 * message prefilled; the user still has to tap Send themselves. */
export function buildWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${normalizeWhatsappPhone(phone)}?text=${encodeURIComponent(message)}`;
}
