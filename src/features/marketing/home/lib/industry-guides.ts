import type { Locale } from "@/components/lang/i18n-provider";

/**
 * The blog guide each "What is Epidom used for?" card links to, by kind of
 * business. Slugs live in src/features/marketing/blog/content/posts.industries.*
 * (same topic in all three languages, written for each rather than translated).
 */
export type IndustryKind = "cafe" | "restaurant" | "bakery" | "bar" | "truck";

export const INDUSTRY_GUIDES: Record<Locale, Record<IndustryKind, string>> = {
  en: {
    cafe: "run-a-cafe-orders-margin-stock",
    restaurant: "restaurant-table-ordering-kitchen-flow",
    bakery: "bakery-costing-batch-stock",
    bar: "bar-pour-cost-rounds-closing",
    truck: "food-truck-short-menu-fast-line",
  },
  fr: {
    cafe: "gerer-un-cafe-commandes-marge-stock",
    restaurant: "restaurant-commande-a-table-flux-cuisine",
    bakery: "boulangerie-cout-de-revient-stock-production",
    bar: "bar-cout-matiere-tournees-cloture",
    truck: "food-truck-menu-court-file-rapide",
  },
  id: {
    cafe: "mengelola-kafe-pesanan-margin-stok",
    restaurant: "restoran-pesan-dari-meja-alur-dapur",
    bakery: "toko-roti-hpp-stok-produksi",
    bar: "bar-biaya-bahan-ronde-tutup-kasir",
    truck: "food-truck-menu-singkat-antrean-cepat",
  },
};
