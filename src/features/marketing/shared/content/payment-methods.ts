import type { Locale } from "@/components/lang/i18n-provider";

export interface PaymentMethodTile {
  n: string;
  c: string;
}

/**
 * Payment methods shown in the marketing site's decorative checkout
 * mockups (services page OrderVisual, home page core-products checkout
 * preview) — market-specific, not a fixed list. QRIS/GoPay/OVO are real
 * Indonesia-only rails (via Xendit, see AGENTS.md); showing them on a
 * France-market page would be wrong, not just untranslated. France/
 * worldwide use card-network methods Stripe supports by default (no
 * specific wallet brand claimed beyond what that actually covers).
 */
export const PAYMENT_METHODS: Record<Locale, PaymentMethodTile[]> = {
  fr: [
    { n: "Carte Bancaire", c: "#0066B3" },
    { n: "Apple Pay", c: "#2b2b2b" },
    { n: "Google Pay", c: "#4C2A86" },
    { n: "Visa", c: "#1F4373" },
    { n: "Mastercard", c: "#3A5B7A" },
    { n: "Espèces", c: "#5A4A2A" },
  ],
  id: [
    { n: "QRIS", c: "#0066B3" },
    { n: "GoPay", c: "#00AED5" },
    { n: "OVO", c: "#4C2A86" },
    { n: "Card", c: "#1F4373" },
    { n: "Bank", c: "#3A5B7A" },
    { n: "Cash", c: "#5A4A2A" },
  ],
  en: [
    { n: "Card", c: "#0066B3" },
    { n: "Apple Pay", c: "#2b2b2b" },
    { n: "Google Pay", c: "#4C2A86" },
    { n: "Visa", c: "#1F4373" },
    { n: "Mastercard", c: "#3A5B7A" },
    { n: "Cash", c: "#5A4A2A" },
  ],
};
