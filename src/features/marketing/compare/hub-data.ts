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
    slug: "laddition",
    name: "L'Addition",
    blurb: {
      fr: "Caisse iPad et modules à la carte, tarifs sur devis.",
      id: "Kasir iPad dengan modul tambahan, harga lewat penawaran.",
      en: "iPad POS with add-on modules, priced on quote.",
    },
  },
  {
    slug: "lightspeed",
    name: "Lightspeed Restaurant",
    blurb: {
      fr: "Caisse sur iPad ou iPhone, qui continue hors ligne sur le réseau local.",
      id: "Kasir di iPad atau iPhone, tetap jalan offline di jaringan lokal.",
      en: "POS on iPad or iPhone that keeps working offline on the local network.",
    },
  },
  {
    slug: "innovorder",
    name: "Innovorder",
    blurb: {
      fr: "Caisse, bornes et commande en ligne, dès 79 €/mois hors matériel.",
      id: "Kasir, kios, dan pesan online, mulai €79/bulan di luar perangkat.",
      en: "POS, kiosks and online ordering, from €79/month excl. hardware.",
    },
  },
  {
    slug: "popina",
    name: "Popina",
    blurb: {
      fr: "Terminal tout-en-un T-ONE, stock et planning de travail.",
      id: "Terminal all-in-one T-ONE, stok, dan jadwal kerja.",
      en: "All-in-one T-ONE terminal, stock and work planning.",
    },
  },
  {
    slug: "zettle",
    name: "Zettle by PayPal",
    blurb: {
      fr: "Appli gratuite, 1,75 % par transaction carte (France).",
      id: "Aplikasi gratis, 1,75% per transaksi kartu (Prancis).",
      en: "Free app, 1.75% per card transaction (France).",
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
  {
    slug: "pawoon",
    name: "Pawoon",
    blurb: {
      fr: "Forfait gratuit à 7 transactions par jour, Pro à 299 000 Rp par point de vente et par mois.",
      id: "Paket gratis 7 transaksi/hari, Pro Rp299rb/outlet/bulan.",
      en: "Free plan up to 7 transactions a day, Pro Rp299k per outlet a month.",
    },
  },
  {
    slug: "qasir",
    name: "Qasir",
    blurb: {
      fr: "Qasir Pro à 699 000 Rp pour 12 mois, essai de 7 jours.",
      id: "Qasir Pro Rp699.000 per 12 bulan, uji coba 7 hari.",
      en: "Qasir Pro Rp699,000 per 12 months, 7-day trial.",
    },
  },
  {
    slug: "olsera",
    name: "Olsera",
    blurb: {
      fr: "Forfaits annuels dès 1 288 000 Rp, essai de 14 jours.",
      id: "Paket tahunan mulai Rp 1.288.000, uji coba 14 hari.",
      en: "Yearly plans from Rp 1,288,000, 14-day trial.",
    },
  },
  {
    slug: "esb",
    name: "ESB",
    blurb: {
      fr: "Basic à 0 Rp* (conditions), Advanced dès 499 000 Rp par mois.",
      id: "Basic Rp0* (S&K berlaku), Advanced mulai Rp499.000/bulan.",
      en: "Basic from Rp0* (terms apply), Advanced from Rp499,000 a month.",
    },
  },
  {
    slug: "kasir-pintar",
    name: "Kasir Pintar",
    blurb: {
      fr: "Forfait gratuit limité, Pro à 666 000 Rp par an.",
      id: "Paket gratis dengan batasan, Pro Rp 666.000 per tahun.",
      en: "Free plan with limits, Pro Rp 666,000 a year.",
    },
  },
];
