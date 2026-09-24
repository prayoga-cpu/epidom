import type { Locale } from "@/components/lang/i18n-provider";

/**
 * Names shown in the Services page "Integrations" grid — every entry here
 * must trace to a real, confirmed capability (see AGENTS.md §3 stack,
 * §6 images/printers). Previously this list mixed confirmed integrations
 * (Stripe, WhatsApp, QRIS/GoPay/OVO via Xendit) with brand names that
 * don't appear anywhere in the product's actual stack (SumUp, Brother,
 * Dymo, Google Sheets, QuickBooks) — removed rather than guessed at.
 * Also market-specific: QRIS/GoPay/OVO/DANA are Indonesia-only rails,
 * wrong to show on a France/worldwide page.
 * Google Reviews is the storefront's review button (2.91.0): a deep link into
 * Google's own review form, not an API integration.
 */
export const INTEGRATIONS: Record<Locale, string[]> = {
  fr: [
    "Stripe",
    "Visa",
    "Mastercard",
    "Apple Pay",
    "Google Pay",
    "WhatsApp",
    "Google Reviews",
    "Imprimante ESC/POS",
  ],
  id: ["QRIS", "GoPay", "OVO", "DANA", "Stripe", "WhatsApp", "Google Reviews", "Printer ESC/POS"],
  en: [
    "Stripe",
    "Visa",
    "Mastercard",
    "Apple Pay",
    "Google Pay",
    "WhatsApp",
    "Google Reviews",
    "ESC/POS Printer",
  ],
};
