import type { Locale } from "@/components/lang/i18n-provider";
import type { PageIntroId } from "@/lib/guide/contracts";

/**
 * The docs guides (src/features/marketing/docs/content) as the in-app Help
 * centre reads them.
 *
 * Guide slugs are per language on purpose: the public /docs site gives each
 * language its own URL, and its hreflang test forbids one slug shared by two
 * languages. So an in-app link can't name "the" slug of a guide. It names the
 * English slug as a stable id (or any language's slug — a French link opened
 * after switching to English still works), and resolveHelpGuide maps it to the
 * viewer's language.
 *
 * No guide content is imported here, so a page intro can link to a guide
 * without shipping every article; help-guide-content.ts reads the articles.
 *
 * A new guide needs a row here in all three languages; the help-guides test
 * fails until it has one.
 */
export const HELP_GUIDE_SLUGS = {
  "getting-started": { en: "getting-started", fr: "demarrage", id: "mulai" },
  "setting-up-your-menu": { en: "setting-up-your-menu", fr: "configurer-le-menu", id: "atur-menu" },
  "receiving-orders": {
    en: "receiving-orders",
    fr: "recevoir-des-commandes",
    id: "terima-pesanan",
  },
  "sharing-your-storefront": {
    en: "sharing-your-storefront",
    fr: "partager-sa-vitrine",
    id: "bagikan-toko",
  },
  "upgrading-to-pos": {
    en: "upgrading-to-pos",
    fr: "passer-a-la-caisse-pos",
    id: "upgrade-ke-kasir-pos",
  },
  "pos-system-and-operational": {
    en: "pos-system-and-operational",
    fr: "caisse-et-operationnel",
    id: "sistem-kasir-dan-operasional",
  },
  "stock-and-supplier-orders": {
    en: "stock-and-supplier-orders",
    fr: "stock-et-commandes-fournisseurs",
    id: "stok-dan-pesanan-pemasok",
  },
  "staff-schedules-and-shifts": {
    en: "staff-schedules-and-shifts",
    fr: "equipe-plannings-et-quarts",
    id: "staf-jadwal-dan-sif",
  },
  "hardware-printers-and-scanner": {
    en: "hardware-printers-and-scanner",
    fr: "materiel-imprimantes-et-scanner",
    id: "perangkat-printer-dan-scanner",
  },
} as const satisfies Record<string, Record<Locale, string>>;

export type HelpGuideId = keyof typeof HELP_GUIDE_SLUGS;

export const HELP_GUIDE_IDS = Object.keys(HELP_GUIDE_SLUGS) as HelpGuideId[];

/**
 * What a cashier reaches for first. The Help sheet in POS Mode lists these on
 * top, in this order, and everything else after them.
 */
export const POS_GUIDE_IDS: readonly HelpGuideId[] = [
  "pos-system-and-operational",
  "hardware-printers-and-scanner",
  "staff-schedules-and-shifts",
  "receiving-orders",
];

/** The guide each page intro's "Learn more" opens. A page with none shows no link. */
export const PAGE_INTRO_GUIDES: Partial<Record<PageIntroId, HelpGuideId>> = {
  storefront: "getting-started",
  data: "stock-and-supplier-orders",
  stock: "stock-and-supplier-orders",
  schedule: "staff-schedules-and-shifts",
  shifts: "staff-schedules-and-shifts",
  orderQueue: "pos-system-and-operational",
  kitchen: "pos-system-and-operational",
  tables: "pos-system-and-operational",
  operational: "pos-system-and-operational",
  hardware: "hardware-printers-and-scanner",
};

/** `?guide=` on the Help page. */
export const HELP_GUIDE_PARAM = "guide";

/** How many releases the Help centre's "What's new" shows; the changelog page has the rest. */
export const HELP_RELEASE_COUNT = 3;

/**
 * Window event the welcome tour listens for (same name as welcome-tour.tsx's
 * export). Help → Replay the tour always dispatches it as a cancelable event:
 * a mounted tour claims it (preventDefault) and opens in place; when nothing
 * claims it, Help navigates to the dashboard with the replay link instead.
 */
export const OPEN_TOUR_EVENT = "epidom:open-tour";

/** The id of the guide `slug` (any language's slug, or the id itself), or null. */
export function helpGuideIdFor(slug: string): HelpGuideId | null {
  for (const id of HELP_GUIDE_IDS) {
    const slugs: Record<Locale, string> = HELP_GUIDE_SLUGS[id];
    if (id === slug || Object.values(slugs).includes(slug)) return id;
  }
  return null;
}

/** `slug` in `locale` when it is a known guide; otherwise `slug` unchanged. */
export function localizedGuideSlug(slug: string, locale: Locale): string {
  const id = helpGuideIdFor(slug);
  return id ? HELP_GUIDE_SLUGS[id][locale] : slug;
}

/** The Back Office Help page, optionally opened on a guide. */
export function helpPageHref(storeId: string, guideSlug?: string | null): string {
  const base = `/store/${storeId}/help`;
  return guideSlug ? `${base}?${HELP_GUIDE_PARAM}=${encodeURIComponent(guideSlug)}` : base;
}

/**
 * The dashboard, asked to open the welcome tour (read by the dashboard's tour,
 * which opens it for any viewer, seen or not, then drops the param).
 */
export function tourHref(storeId: string): string {
  return `/store/${storeId}/dashboard?tour=1`;
}

/**
 * The dashboard, asked to show the Getting-started checklist (even on an
 * established store, or one where it was hidden); the checklist drops the
 * param once read, so Back or a reload doesn't bring a hidden one back.
 */
export function checklistHref(storeId: string): string {
  return `/store/${storeId}/dashboard?checklist=1`;
}
