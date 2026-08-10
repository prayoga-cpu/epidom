import type { Locale } from "@/components/lang/i18n-provider";

export interface CompareHubEntry {
  slug: string;
  name: string;
  blurb: Record<Locale, string>;
}

// Ordered by market relevance: France-relevant first (primary market),
// Indonesia-relevant second, plus the always-relevant delivery-commission
// comparison. Each blurb is short and locale-neutral enough to show
// regardless of which locale the visitor is on — full comparisons are
// only authored in their relevant market locales (see data/*.ts).
export const COMPARE_HUB_ENTRIES: CompareHubEntry[] = [
  {
    slug: "delivery-commission",
    name: "GoFood / GrabFood / Deliveroo / Uber Eats",
    blurb: {
      fr: "Combien vous coûte vraiment une commande via une app de livraison.",
      id: "Berapa sebenarnya biaya pesanan lewat aplikasi delivery.",
      en: "What an order through a delivery app really costs you.",
    },
  },
  {
    slug: "sunday",
    name: "Sunday",
    blurb: {
      fr: "Une couche de paiement sur votre caisse, pas une caisse.",
      id: "Layer pembayaran di atas kasir kamu, bukan kasir itu sendiri.",
      en: "A payment layer on your POS, not a POS itself.",
    },
  },
  {
    slug: "sumup-pos-pro",
    name: "SumUp POS Pro (formerly Tiller)",
    blurb: {
      fr: "Sur devis, sans vitrine client incluse.",
      id: "Harga custom, tanpa toko online termasuk.",
      en: "Quote-only pricing, no customer storefront included.",
    },
  },
  {
    slug: "zelty",
    name: "Zelty",
    blurb: {
      fr: "Aucun tarif public — tout passe par les ventes.",
      id: "Nggak ada harga publik — semua lewat sales.",
      en: "No public pricing — everything goes through sales.",
    },
  },
  {
    slug: "moka",
    name: "Moka POS",
    blurb: {
      fr: "Essai gratuit, puis abonnement dès 299 000 Rp/mois.",
      id: "Coba gratis, lalu berbayar mulai Rp 299.000/bulan.",
      en: "Free trial, then paid from Rp 299,000/month.",
    },
  },
  {
    slug: "majoo",
    name: "Majoo",
    blurb: {
      fr: "Essai de 14 jours, tarifs non publiés.",
      id: "Uji coba 14 hari, harga nggak dipublikasikan.",
      en: "14-day trial, pricing not published.",
    },
  },
  {
    slug: "klikit",
    name: "Klikit",
    blurb: {
      fr: "Tarification sur devis, pensée pour le multi-plateforme.",
      id: "Harga custom, fokus buat multi-platform aggregator.",
      en: "Custom-quoted pricing, built for multi-platform aggregation.",
    },
  },
];
