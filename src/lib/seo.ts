import { Metadata } from "next";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALES, DEFAULT_LOCALE, getLocalizedPath, stripLocalePrefix } from "@/lib/i18n-routing";
import { SUPPORT_EMAIL_PRIMARY } from "@/lib/constants/contact";

export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  openGraph?: {
    title?: string;
    description?: string;
    url?: string;
    siteName?: string;
    images?: Array<{
      url: string;
      width?: number;
      height?: number;
      alt?: string;
    }>;
    locale?: string;
    type?: string;
  };
  twitter?: {
    card?: "summary" | "summary_large_image" | "app" | "player";
    site?: string;
    creator?: string;
    title?: string;
    description?: string;
    images?: string[];
  };
  robots?: {
    index?: boolean;
    follow?: boolean;
    googleBot?: {
      index?: boolean;
      follow?: boolean;
      "max-video-preview"?: number;
      "max-image-preview"?: "none" | "standard" | "large";
      "max-snippet"?: number;
    };
  };
  alternates?: {
    canonical?: string;
    languages?: Record<string, string>;
  };
  other?: Record<string, string>;
}

const defaultSEO: SEOConfig = {
  title: "Epidom — Storefront, Online Ordering & POS for F&B",
  description:
    "A public menu page with online ordering, plus a POS cashier, for cafés, restaurants, and warungs. The storefront is free forever; the POS starts with a 14-day free trial.",
  // Market priority (2026-08-10): France primary, Indonesia secondary,
  // worldwide beyond both — see docs/STRATEGY.md §3. This is the
  // locale-agnostic base default; per-locale pages should override with
  // market-specific terms (fr: "logiciel caisse restaurant gratuit",
  // "carte qr code restaurant"; id: "aplikasi kasir warung gratis", "menu
  // qr resto") once locale routing lands.
  keywords: [
    "restaurant pos software",
    "digital menu qr code",
    "online food ordering",
    "free pos app",
    "cafe cashier software",
    "qr code menu restaurant",
    "kitchen display system",
    "f&b storefront",
    "epidom",
  ],
  openGraph: {
    title: "Epidom — Storefront, Online Ordering & POS for F&B",
    description:
      "Public menu page, WhatsApp & online ordering, and POS cashier for cafés, restaurants, and warungs. Free storefront, forever.",
    url: "https://epidom.fr",
    siteName: "Epidom",
    images: [
      {
        // TODO(operator): swap for a dedicated 1200x630 designed OG card —
        // this is a real product screenshot used as a stopgap, see STATUS.md.
        url: "https://epidom.fr/images/screenshot-wide-1.png",
        width: 1602,
        height: 1067,
        alt: "Epidom — F&B Online Storefront & POS Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@epidom",
    creator: "@epidom",
    title: "Epidom — Storefront, Online Ordering & POS for F&B",
    description:
      "Public menu page, WhatsApp & online ordering, and POS cashier for F&B businesses. Free storefront, forever.",
    images: ["https://epidom.fr/images/screenshot-wide-1.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const SITE_ORIGIN = "https://epidom.fr";

/**
 * hreflang alternates for a marketing page, derived from its canonical URL
 * (the unprefixed/fr form — see src/lib/i18n-routing.ts). fr has no prefix
 * (primary market, docs/STRATEGY.md §3); id/en are prefixed. x-default points
 * at fr, same reasoning.
 *
 * This assumes the page exists in ALL three locales. A page whose content is
 * authored in only some of them must not use this default — it passes its own
 * `alternates.languages`, see buildLocaleAlternates below.
 *
 * A locale-PREFIXED canonical (/id/blog/x) is one locale's own URL, computed per
 * request by pages whose content differs per locale. Re-prefixing it for every
 * locale produced URLs like /id/id/blog/x, so all this can honestly claim is the
 * page itself.
 */
function buildHreflangAlternates(canonicalUrl: string): Record<string, string> {
  const path = canonicalUrl.replace(SITE_ORIGIN, "") || "/";
  const { locale, basePath } = stripLocalePrefix(path);
  if (basePath !== path) return { [locale]: canonicalUrl };

  const languages: Record<string, string> = {};
  for (const l of LOCALES) {
    languages[l] = `${SITE_ORIGIN}${getLocalizedPath(basePath, l)}`;
  }
  languages["x-default"] = languages[DEFAULT_LOCALE];
  return languages;
}

/**
 * Locales a `Partial<Record<Locale, …>>` content map really has content for, in
 * the map's own key order — the order resolveServedLocale's "first authored"
 * fallback relies on.
 */
export function getAuthoredLocales(content: Partial<Record<Locale, unknown>>): Locale[] {
  return (Object.keys(content) as Locale[]).filter(
    (locale) => LOCALES.includes(locale) && Boolean(content[locale])
  );
}

/**
 * The locale whose content is actually rendered for a visitor asking for
 * `requested`: their own locale when authored, else English (worldwide), else
 * the first authored one. Same rule the compare pages use to pick their copy,
 * so the URL a page declares as canonical can never drift from what it shows.
 */
export function resolveServedLocale(authored: readonly Locale[], requested: Locale): Locale {
  if (authored.includes(requested)) return requested;
  if (authored.includes("en")) return "en";
  return authored[0] ?? requested;
}

/**
 * hreflang map for a page authored in only the `authored` locales: one entry
 * per authored locale and nothing for the rest (a locale that just falls back
 * to another's copy is not an alternate, it is a duplicate). x-default is fr
 * when authored, else en, else the first authored.
 */
export function buildAuthoredHreflang(
  basePath: string,
  authored: readonly Locale[]
): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of authored) {
    languages[locale] = `${SITE_ORIGIN}${getLocalizedPath(basePath, locale)}`;
  }
  const fallback = authored.includes(DEFAULT_LOCALE)
    ? DEFAULT_LOCALE
    : authored.includes("en")
      ? "en"
      : authored[0];
  if (fallback) languages["x-default"] = languages[fallback];
  return languages;
}

export interface LocaleAlternates {
  /** The locale whose content the request actually gets. */
  servedLocale: Locale;
  /** URL of the served locale's copy — where a fallback visit must point. */
  canonical: string;
  /** Pass as `alternates.languages` to generateMetadata. */
  languages: Record<string, string>;
}

/**
 * Canonical + hreflang for a page that is authored in only some locales and
 * falls back to another for the rest. A visitor on a non-authored locale sees
 * the fallback copy, so their URL must canonicalize to that copy's own URL
 * instead of to itself (which would make every fallback URL a duplicate of
 * the real one), and hreflang lists only the authored locales.
 *
 * `basePath` is unprefixed ("/compare/sunday").
 */
export function buildLocaleAlternates({
  basePath,
  authoredLocales,
  requestedLocale,
}: {
  basePath: string;
  authoredLocales: readonly Locale[];
  requestedLocale: Locale;
}): LocaleAlternates {
  const servedLocale = resolveServedLocale(authoredLocales, requestedLocale);
  return {
    servedLocale,
    canonical: `${SITE_ORIGIN}${getLocalizedPath(basePath, servedLocale)}`,
    languages: buildAuthoredHreflang(basePath, authoredLocales),
  };
}

export function generateMetadata(config: Partial<SEOConfig> = {}): Metadata {
  const seo = { ...defaultSEO, ...config };
  const canonicalUrl = seo.canonical || seo.alternates?.canonical;
  const openGraphTitle = seo.openGraph?.title || seo.title;
  const openGraphDescription = seo.openGraph?.description || seo.description;

  return {
    title: {
      default: seo.title,
      template: `%s | ${seo.title}`,
    },
    description: seo.description,
    keywords: seo.keywords?.join(", "),
    authors: [{ name: "EPIDOM Team" }],
    creator: "EPIDOM",
    publisher: "EPIDOM",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL("https://epidom.fr"),
    alternates: {
      canonical: canonicalUrl,
      languages:
        seo.alternates?.languages ??
        (canonicalUrl?.startsWith("https://epidom.fr")
          ? buildHreflangAlternates(canonicalUrl)
          : undefined),
    },
    robots: seo.robots,
    openGraph: {
      title: openGraphTitle,
      description: openGraphDescription,
      url: seo.openGraph?.url,
      siteName: seo.openGraph?.siteName || "EPIDOM",
      images: seo.openGraph?.images,
      locale: seo.openGraph?.locale || "en_US",
      type: (seo.openGraph?.type || "website") as
        | "website"
        | "article"
        | "book"
        | "profile"
        | "music.song"
        | "music.album"
        | "music.playlist"
        | "music.radio_station"
        | "video.movie"
        | "video.episode"
        | "video.tv_show"
        | "video.other",
    },
    twitter: {
      card: seo.twitter?.card || "summary_large_image",
      site: seo.twitter?.site,
      creator: seo.twitter?.creator,
      // `seo.twitter` is the English site default unless the caller passed its
      // own, so reading the title from it made every page that only sets
      // openGraph (the legal pages, an article slug) share the site-wide English
      // card. The caller's own twitter text wins, then the page's Open Graph
      // text, which is what its link preview shows anyway.
      title: config.twitter?.title || openGraphTitle,
      description: config.twitter?.description || openGraphDescription,
      images: seo.twitter?.images,
    },
    other: {
      ...seo.other,
      // The PWA/Apple tags that used to live here are gone on purpose. They
      // were written as raw `other` entries, which Next emits verbatim — it
      // does NOT merge or dedupe them against `metadata.appleWebApp`,
      // `metadata.applicationName` or the exported `viewport.themeColor` in
      // src/app/layout.tsx. Every page built by this helper therefore shipped
      // two of each tag, and because `other` renders first, the stale copies
      // won: `apple-mobile-web-app-status-bar-style: default` beat "black",
      // and `theme-color: #444444` beat the manifest's #18181b.
      //
      // The root layout is the single owner now — including
      // `mobile-web-app-capable`, which Next 16 emits itself from
      // `appleWebApp.capable` (it uses that modern spelling rather than the
      // deprecated `apple-mobile-web-app-capable`), so repeating it here just
      // produced the tag twice.
      "msapplication-TileColor": "#18181b",
    },
  };
}

/** `og:locale` value for each site language. */
export const OG_LOCALE: Record<Locale, string> = { fr: "fr_FR", id: "id_ID", en: "en_US" };

export interface LocalizedPageSEO {
  /** Unprefixed path of the page ("/pricing", "/" for home). */
  basePath: string;
  /** The locale the request asked for (from the proxy's x-epidom-locale header). */
  locale: Locale;
  title: string;
  description: string;
  /** Short social-card variants; both fall back to title / description. */
  ogTitle?: string;
  ogDescription?: string;
  keywords?: string[];
  /** Locales the page really has its own copy in. Defaults to all of them. */
  authoredLocales?: readonly Locale[];
}

/**
 * Metadata for a marketing page whose title/description are written per
 * locale. The canonical, Open Graph URL and og:locale all describe the locale
 * that is actually served (fr unprefixed, /id and /en prefixed), so a
 * translated URL never claims to be a duplicate of the fr one, and hreflang
 * lists every authored locale with x-default on fr.
 *
 * Twitter is filled from the same strings: left to the defaults it would carry
 * the English site-wide title and description on every page.
 */
export function buildLocalizedMetadata({
  basePath,
  locale,
  title,
  description,
  ogTitle = title,
  ogDescription = description,
  keywords,
  authoredLocales = LOCALES,
}: LocalizedPageSEO): Metadata {
  const { servedLocale, canonical, languages } = buildLocaleAlternates({
    basePath,
    authoredLocales,
    requestedLocale: locale,
  });

  return generateMetadata({
    title,
    description,
    keywords,
    canonical,
    alternates: { canonical, languages },
    openGraph: {
      ...defaultSEO.openGraph,
      siteName: "EPIDOM",
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      locale: OG_LOCALE[servedLocale],
    },
    twitter: { ...defaultSEO.twitter, title: ogTitle, description: ogDescription },
  });
}

// Structured Data for JSON-LD
export function generateStructuredData(
  type: "website" | "organization" | "product" | "service",
  data?: any
) {
  const baseUrl = "https://epidom.fr";

  const structuredData = {
    "@context": "https://schema.org",
    "@type":
      type === "website"
        ? "WebSite"
        : type === "organization"
          ? "Organization"
          : type === "product"
            ? "SoftwareApplication"
            : "Service",
    name: "Epidom",
    description:
      "Online store, menu page, and POS cashier platform for cafés, warungs, and restaurants.",
    url: baseUrl,
    logo: `${baseUrl}/images/logo.svg`,
    image: `${baseUrl}/images/screenshot-wide-1.png`,
    // Kept in sync with SOCIAL in site-footer.tsx — Instagram is the only
    // actively maintained account.
    sameAs: ["https://instagram.com/epidom.fr"],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: SUPPORT_EMAIL_PRIMARY,
    },
    // No foundingDate: nothing in the repo supports a year, and JSON-LD is a
    // claim made to search engines.
    ...data,
  };

  return structuredData;
}
