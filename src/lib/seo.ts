import { Metadata } from "next";
import { LOCALES, DEFAULT_LOCALE, getLocalizedPath } from "@/lib/i18n-routing";

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
  title: "Epidom — Free Storefront, Online Ordering & POS for F&B",
  description:
    "Free public menu page, online ordering, and POS cashier for cafés, restaurants, and warungs. No commission, no delivery-app fees. Free forever.",
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
    title: "Epidom — Free Storefront, Online Ordering & POS for F&B",
    description:
      "Free public menu page, WhatsApp & online ordering, and POS cashier for cafés, restaurants, and warungs. Free forever.",
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
    title: "Epidom — Free Storefront, Online Ordering & POS for F&B",
    description:
      "Free public menu page, WhatsApp & online ordering, and POS cashier. Free forever for F&B businesses.",
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

/**
 * hreflang alternates for a marketing page, derived from its canonical URL
 * (always the unprefixed/fr form — see src/lib/i18n-routing.ts). fr has no
 * prefix (primary market, docs/STRATEGY.md §3); id/en are prefixed.
 * x-default points at fr, same reasoning.
 */
function buildHreflangAlternates(canonicalUrl: string): Record<string, string> {
  const basePath = canonicalUrl.replace("https://epidom.fr", "") || "/";
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    languages[locale] = `https://epidom.fr${getLocalizedPath(basePath, locale)}`;
  }
  languages["x-default"] = languages[DEFAULT_LOCALE];
  return languages;
}

export function generateMetadata(config: Partial<SEOConfig> = {}): Metadata {
  const seo = { ...defaultSEO, ...config };
  const canonicalUrl = seo.canonical || seo.alternates?.canonical;

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
      title: seo.openGraph?.title || seo.title,
      description: seo.openGraph?.description || seo.description,
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
      title: seo.twitter?.title || seo.title,
      description: seo.twitter?.description || seo.description,
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
      email: "consult@prionation.io",
    },
    foundingDate: "2024",
    ...data,
  };

  return structuredData;
}
