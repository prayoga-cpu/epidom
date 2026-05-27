import { Metadata } from "next";

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
  title: "Epidom — Online Store, Menu & POS for F&B",
  description:
    "Create a menu page, accept online orders, manage your POS cashier and kitchen — all in one platform. Free forever for cafés, warungs, and restaurants.",
  keywords: [
    "f&b pos app",
    "digital menu page",
    "online food ordering",
    "restaurant cashier software",
    "kitchen display system",
    "qris payments",
    "inventory management",
    "epidom",
  ],
  openGraph: {
    title: "Epidom — Online Store, Menu & POS for F&B",
    description:
      "Create a menu page, accept online orders, manage your POS cashier and kitchen. Free forever.",
    url: "https://epidom.fr",
    siteName: "Epidom",
    images: [
      {
        url: "https://epidom.fr/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Epidom — F&B Online Store & POS Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@epidom",
    creator: "@epidom",
    title: "Epidom — Online Store, Menu & POS for F&B",
    description:
      "Create a menu page, accept online orders, and manage your POS cashier. Free forever for F&B businesses.",
    images: ["https://epidom.fr/images/twitter-card.jpg"],
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

export function generateMetadata(config: Partial<SEOConfig> = {}): Metadata {
  const seo = { ...defaultSEO, ...config };

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
      canonical: seo.canonical || seo.alternates?.canonical,
      languages: seo.alternates?.languages,
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
      "application-name": "EPIDOM",
      "apple-mobile-web-app-title": "EPIDOM",
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-status-bar-style": "default",
      "mobile-web-app-capable": "yes",
      "msapplication-TileColor": "#444444",
      "theme-color": "#444444",
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
    image: `${baseUrl}/images/og-image.jpg`,
    sameAs: [
      "https://twitter.com/epidom",
      "https://linkedin.com/company/epidom",
      "https://github.com/epidom",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "prayogadevelopment@gmail.com",
    },
    foundingDate: "2024",
    ...data,
  };

  return structuredData;
}
