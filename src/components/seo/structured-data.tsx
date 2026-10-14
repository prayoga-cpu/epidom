import React from "react";
import type { Locale } from "@/components/lang/i18n-provider";
import { generateStructuredData } from "@/lib/seo";
import { STOREFRONT_ONLINE_PAYMENTS_ENABLED } from "@/config/storefront-ordering.config";
import {
  LOCALE_PRICE_CURRENCY,
  PLAN_PRICING,
  type PriceCurrency,
} from "@/lib/constants/plan-pricing";

interface StructuredDataProps {
  type: "website" | "organization" | "product" | "service";
  data?: any;
}

export function StructuredData({ type, data }: StructuredDataProps) {
  const structuredData = generateStructuredData(type, data);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData, null, 2),
      }}
    />
  );
}

// Predefined structured data components.
// Note: no aggregateRating/review schema anywhere here — do not add one
// until real, verifiable reviews exist. Fabricated review counts are a
// Google Rich Results policy violation and a trust liability, not a growth
// lever (see AGENTS.md "graceful degradation" — dummy data is fine for
// unimplemented app features, not for facts asserted to search engines).
// The same goes for capabilities: no SearchAction while the site has no /search
// page, and no foundingDate until there is a date to point to.

/** schema.org `inLanguage` for each site language. */
const IN_LANGUAGE: Record<Locale, string> = { fr: "fr-FR", id: "id-ID", en: "en" };

/** What Epidom is, in the language of the page carrying the JSON-LD. */
const SITE_DESCRIPTION: Record<Locale, string> = {
  fr: "Caisse en temps réel, menu en ligne et commande en ligne pour cafés, boulangeries et restaurants.",
  id: "Aplikasi kasir realtime, halaman menu, dan pesanan online untuk kafe, warung, dan restoran.",
  en: "Realtime POS, online menu page and online ordering for cafés, bakeries and restaurants.",
};

const ORGANIZATION_DESCRIPTION: Record<Locale, string> = {
  fr: "Epidom est une plateforme de vitrine en ligne, de commande en ligne et de caisse pour cafés et restaurants, conçue par Prionation.",
  id: "Epidom adalah platform toko online, pesanan online, dan aplikasi kasir untuk kafe, warung, dan restoran, dibuat oleh Prionation.",
  en: "Epidom is a public storefront, online ordering and POS platform for cafés, restaurants and warungs, built by Prionation.",
};

export function WebsiteStructuredData({ locale }: { locale: Locale }) {
  return (
    <StructuredData
      type="website"
      data={{ description: SITE_DESCRIPTION[locale], inLanguage: IN_LANGUAGE[locale] }}
    />
  );
}

export function OrganizationStructuredData({ locale }: { locale: Locale }) {
  return (
    <StructuredData
      type="organization"
      data={{
        industry: "Food & Beverage Technology",
        description: ORGANIZATION_DESCRIPTION[locale],
        founder: [
          { "@type": "Person", name: "Evan Cao", jobTitle: "Founder" },
          { "@type": "Person", name: "Darwin Prayoga", jobTitle: "Founder, Prionation" },
        ],
        parentOrganization: {
          "@type": "Organization",
          name: "Prionation",
          url: "https://www.prionation.io",
        },
      }}
    />
  );
}

/**
 * The plans as Offers, in the currency the page quotes (fr EUR, en USD, id
 * IDR — LOCALE_PRICE_CURRENCY), at the monthly price from the one pricing
 * table. Each description says only what that plan unlocks
 * (FEATURE_MIN_PLAN): online orders are POS, not Free.
 */
const OFFER_COPY: Record<Locale, { free: string; pos: string; operations: string }> = {
  fr: {
    free: "Vitrine gratuite à vie : page menu et QR code.",
    pos: "Caisse, commandes en ligne et réservations. 14 jours d'essai gratuit.",
    operations:
      "Tout le forfait POS, plus planning d'équipe, stocks et coût des recettes, rapports financiers et jusqu'à 3 établissements.",
  },
  id: {
    free: "Halaman toko gratis selamanya: halaman menu dan QR code.",
    pos: "Kasir POS, pesanan online, dan reservasi. Uji coba gratis 14 hari.",
    operations:
      "Semua fitur POS, plus jadwal staf, stok dan HPP resep, laporan keuangan, dan hingga 3 outlet.",
  },
  en: {
    free: "Storefront free forever: a menu page and QR code.",
    pos: "POS, online orders and table reservations. 14-day free trial.",
    operations:
      "Everything in POS, plus staff schedules, stock and recipe costing, finance reports and up to 3 outlets.",
  },
};

const FEATURE_LIST: Record<Locale, string[]> = {
  fr: [
    "Vitrine en ligne gratuite (page menu)",
    "Notifications de commande WhatsApp",
    STOREFRONT_ONLINE_PAYMENTS_ENABLED
      ? "Paiements en ligne par carte"
      : "Commande en ligne, payée au comptoir",
    "Caisse et tickets",
    "Écran cuisine (KDS)",
    "Planning et pointage de l'équipe",
    "Stocks et coût des recettes",
    "Rapports financiers multi-établissements",
  ],
  id: [
    "Halaman toko online gratis (halaman menu)",
    "Notifikasi pesanan WhatsApp",
    STOREFRONT_ONLINE_PAYMENTS_ENABLED
      ? "Pembayaran online kartu dan lokal"
      : "Pesanan online, bayar di kasir",
    "Kasir POS dan struk",
    "Kitchen display system (KDS)",
    "Jadwal dan absensi staf",
    "Stok dan HPP resep",
    "Laporan keuangan multi-outlet",
  ],
  en: [
    "Free public online storefront (menu page)",
    "WhatsApp order notifications",
    STOREFRONT_ONLINE_PAYMENTS_ENABLED
      ? "Card and local online payments"
      : "Online ordering, paid at the counter",
    "POS cashier and receipts",
    "Kitchen display system",
    "Staff shift management",
    "Inventory and recipe costing",
    "Multi-outlet finance reporting",
  ],
};

function monthlyOffer(name: string, description: string, price: number, currency: PriceCurrency) {
  return {
    "@type": "Offer",
    name,
    description,
    price: String(price),
    priceCurrency: currency,
    availability: "https://schema.org/InStock",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: String(price),
      priceCurrency: currency,
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
    },
  };
}

export function ProductStructuredData({ locale }: { locale: Locale }) {
  const currency = LOCALE_PRICE_CURRENCY[locale];
  const copy = OFFER_COPY[locale];
  return (
    <StructuredData
      type="product"
      data={{
        description: SITE_DESCRIPTION[locale],
        inLanguage: IN_LANGUAGE[locale],
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web Browser",
        offers: [
          {
            "@type": "Offer",
            name: "Free",
            description: copy.free,
            price: "0",
            priceCurrency: currency,
            availability: "https://schema.org/InStock",
          },
          monthlyOffer("POS", copy.pos, PLAN_PRICING.POS[currency].monthly, currency),
          monthlyOffer(
            "Operations",
            copy.operations,
            PLAN_PRICING.OPERATIONS[currency].monthly,
            currency
          ),
        ],
        featureList: FEATURE_LIST[locale],
      }}
    />
  );
}

interface StorefrontOpeningHoursDay {
  open?: string;
  close?: string;
  isClosed?: boolean;
}

interface StorefrontOpeningHours {
  monday?: StorefrontOpeningHoursDay;
  tuesday?: StorefrontOpeningHoursDay;
  wednesday?: StorefrontOpeningHoursDay;
  thursday?: StorefrontOpeningHoursDay;
  friday?: StorefrontOpeningHoursDay;
  saturday?: StorefrontOpeningHoursDay;
  sunday?: StorefrontOpeningHoursDay;
}

const SCHEMA_DAY: Record<keyof StorefrontOpeningHours, string> = {
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
  sunday: "https://schema.org/Sunday",
};

/**
 * FoodEstablishment JSON-LD for a merchant's public storefront (/@slug) —
 * the highest commercial-intent indexable page in the product (real local
 * businesses, real menus). "FoodEstablishment" rather than "Restaurant" so
 * it fits warung/café/home-kitchen storefronts too, not just restaurants.
 */
export function StorefrontStructuredData({
  slug,
  displayName,
  tagline,
  description,
  logoUrl,
  heroImageUrl,
  whatsappNumber,
  instagramUrl,
  tiktokUrl,
  googleMapsUrl,
  openingHours,
}: {
  slug: string;
  displayName: string;
  tagline?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  whatsappNumber?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  googleMapsUrl?: string | null;
  openingHours?: unknown;
}) {
  const url = `https://epidom.fr/@${slug}`;
  const hours = (openingHours as StorefrontOpeningHours) || {};
  const openingHoursSpecification = (Object.keys(SCHEMA_DAY) as Array<keyof StorefrontOpeningHours>)
    .map((day) => {
      const dayHours = hours[day];
      if (!dayHours || dayHours.isClosed || !dayHours.open || !dayHours.close) return null;
      return {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: SCHEMA_DAY[day],
        opens: dayHours.open,
        closes: dayHours.close,
      };
    })
    .filter(Boolean);

  const data = {
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    name: displayName,
    description: tagline || description || undefined,
    url,
    hasMenu: `${url}/menu`,
    image: heroImageUrl || logoUrl || undefined,
    telephone: whatsappNumber || undefined,
    sameAs: [instagramUrl, tiktokUrl, googleMapsUrl].filter(Boolean),
    ...(openingHoursSpecification.length > 0 ? { openingHoursSpecification } : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Menu JSON-LD for a storefront's /@slug/menu page — real priced items,
 * good rich-result and AEO ("what does X serve", "how much is Y at X")
 * candidate. Only available (isAvailable) items are included.
 */
export function MenuStructuredData({
  slug,
  displayName,
  categories,
}: {
  slug: string;
  displayName: string;
  categories: Array<{
    name: string;
    items: Array<{
      name: string;
      description?: string | null;
      price: number;
      currency: string;
      isAvailable: boolean;
    }>;
  }>;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: `${displayName} Menu`,
    url: `https://epidom.fr/@${slug}/menu`,
    hasMenuSection: categories
      .filter((cat) => cat.items.some((i) => i.isAvailable))
      .map((cat) => ({
        "@type": "MenuSection",
        name: cat.name,
        hasMenuItem: cat.items
          .filter((item) => item.isAvailable)
          .map((item) => ({
            "@type": "MenuItem",
            name: item.name,
            description: item.description || undefined,
            offers: {
              "@type": "Offer",
              price: item.price,
              priceCurrency: item.currency,
            },
          })),
      })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * BlogPosting JSON-LD for a /blog/[slug] article.
 */
export function BlogPostingStructuredData({
  url,
  title,
  description,
  datePublished,
}: {
  url: string;
  title: string;
  description: string;
  datePublished: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: title,
    description,
    datePublished,
    author: { "@type": "Organization", name: "Epidom" },
    publisher: {
      "@type": "Organization",
      name: "Epidom",
      logo: { "@type": "ImageObject", url: "https://epidom.fr/images/icon-512.png" },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * FAQPage JSON-LD for AEO/GEO — question/answer text must stay in sync
 * with the visible copy of the FAQ that renders it (see faq-section.tsx).
 * Schema without matching visible text is a Google structured-data
 * violation, so this takes the rendered strings as props rather than
 * duplicating translation keys here.
 */
export function FaqStructuredData({ faqs }: { faqs: Array<{ q: string; a: string }> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map(({ q, a }) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        }),
      }}
    />
  );
}

/**
 * BreadcrumbList JSON-LD: the trail from the home page to the page carrying
 * it, every item an absolute URL in the page's own language. Lets results show
 * "epidom.fr › Blog › …" instead of a bare URL.
 */
export function BreadcrumbStructuredData({
  items,
}: {
  items: ReadonlyArray<{ name: string; url: string }>;
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map(({ name, url }, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name,
            item: url,
          })),
        }),
      }}
    />
  );
}
