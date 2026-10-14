import type { Locale } from "@/components/lang/i18n-provider";

/**
 * Every landing page's slug and language, and nothing else, so the proxy can
 * route them without importing their content. content/index.ts must list
 * exactly these pages (registry.test.ts), and each slug has a route folder at
 * src/app/(marketing)/<slug>/page.tsx (also tested).
 *
 * A page exists in ONE language: `/id/aplikasi-kasir-cafe` is the page; the
 * same slug under another prefix is sent there with a permanent redirect by
 * the proxy, and the visitor's language never redirects it away.
 */
export const LANDING_GROUPS = {
  "recipe-cost": {
    fr: "calcul-cout-de-revient",
    id: "kalkulator-hpp",
    en: "recipe-cost-calculator",
  },
  commission: {
    fr: "calcul-commission-uber-eats",
    id: "kalkulator-komisi-gofood",
    en: "delivery-app-commission-calculator",
  },
  "qr-menu": { fr: "menu-qr-code-gratuit", id: "menu-qr-code-gratis", en: "free-qr-code-menu" },
  "online-ordering": {
    fr: "commande-en-ligne-restaurant",
    id: "pesan-online-tanpa-komisi",
    en: "commission-free-online-ordering",
  },
  cafe: { id: "aplikasi-kasir-cafe", en: "cafe-pos-system" },
  restaurant: { id: "aplikasi-kasir-restoran" },
  bakery: { id: "aplikasi-kasir-toko-roti", en: "bakery-pos-system" },
  offline: { fr: "caisse-hors-ligne", id: "aplikasi-kasir-offline", en: "offline-pos-system" },
  "kitchen-display": {
    fr: "ecran-cuisine-kds",
    id: "layar-dapur-kds",
    en: "kitchen-display-system",
  },
  "stock-recipes": {
    fr: "gestion-stock-restaurant",
    id: "aplikasi-stok-bahan-baku",
    en: "restaurant-inventory-software",
  },
  "staff-scheduling": {
    fr: "planning-personnel-restaurant",
    id: "jadwal-shift-karyawan",
    en: "restaurant-staff-scheduling",
  },
  "receipt-printer": {
    fr: "imprimante-ticket-caisse",
    id: "printer-struk-kasir",
    en: "receipt-printer-pos",
  },
} as const satisfies Record<string, Partial<Record<Locale, string>>>;

export type LandingGroup = keyof typeof LANDING_GROUPS;

/** slug → { locale, group } for every landing page. */
export const LANDING_SLUGS: ReadonlyMap<string, { locale: Locale; group: LandingGroup }> = new Map(
  (
    Object.entries(LANDING_GROUPS) as Array<[LandingGroup, Partial<Record<Locale, string>>]>
  ).flatMap(([group, bySlug]) =>
    (Object.entries(bySlug) as Array<[Locale, string]>).map(
      ([locale, slug]) => [slug, { locale, group }] as const
    )
  )
);

/** The language a landing page is written in, from its unprefixed path ("/kalkulator-hpp"). */
export function landingLocaleFor(basePath: string): Locale | undefined {
  return LANDING_SLUGS.get(basePath.replace(/^\/+|\/+$/g, ""))?.locale;
}

/** The page's siblings in other languages, as { locale: slug }. */
export function landingAlternates(group: LandingGroup): Partial<Record<Locale, string>> {
  return LANDING_GROUPS[group];
}

/**
 * Short link text for each page (footer, related links): the page's search
 * phrase, so internal links carry it. Kept here, not read from the content,
 * so the site-wide footer doesn't ship every page's prose to the browser.
 */
export const LANDING_LABELS: Record<string, string> = {
  "calcul-cout-de-revient": "Calcul du coût de revient",
  "calcul-commission-uber-eats": "Calcul des commissions Uber Eats",
  "menu-qr-code-gratuit": "Menu QR code gratuit",
  "commande-en-ligne-restaurant": "Commande en ligne sans commission",
  "caisse-hors-ligne": "Caisse hors ligne",
  "ecran-cuisine-kds": "Écran cuisine (KDS)",
  "gestion-stock-restaurant": "Gestion de stock restaurant",
  "planning-personnel-restaurant": "Planning du personnel",
  "imprimante-ticket-caisse": "Imprimante ticket de caisse",
  "kalkulator-hpp": "Kalkulator HPP",
  "kalkulator-komisi-gofood": "Kalkulator komisi GoFood",
  "menu-qr-code-gratis": "Menu QR code gratis",
  "pesan-online-tanpa-komisi": "Pesan online tanpa komisi",
  "aplikasi-kasir-cafe": "Aplikasi kasir cafe",
  "aplikasi-kasir-restoran": "Aplikasi kasir restoran",
  "aplikasi-kasir-toko-roti": "Aplikasi kasir toko roti",
  "aplikasi-kasir-offline": "Aplikasi kasir offline",
  "layar-dapur-kds": "Kitchen display (KDS)",
  "aplikasi-stok-bahan-baku": "Aplikasi stok bahan baku",
  "jadwal-shift-karyawan": "Jadwal shift karyawan",
  "printer-struk-kasir": "Printer struk kasir",
  "recipe-cost-calculator": "Recipe cost calculator",
  "delivery-app-commission-calculator": "Delivery commission calculator",
  "free-qr-code-menu": "Free QR code menu",
  "commission-free-online-ordering": "Commission-free online ordering",
  "cafe-pos-system": "Cafe POS system",
  "bakery-pos-system": "Bakery POS system",
  "offline-pos-system": "Offline POS",
  "kitchen-display-system": "Kitchen display system",
  "restaurant-inventory-software": "Restaurant inventory",
  "restaurant-staff-scheduling": "Staff scheduling",
  "receipt-printer-pos": "Receipt printers",
};

/** A language's landing pages in registry order (tools, then businesses, then features). */
export function landingLinksFor(locale: Locale): Array<{ slug: string; label: string }> {
  return Object.values(LANDING_GROUPS).flatMap((bySlug) => {
    const slug = (bySlug as Partial<Record<Locale, string>>)[locale];
    return slug ? [{ slug, label: LANDING_LABELS[slug] ?? slug }] : [];
  });
}
