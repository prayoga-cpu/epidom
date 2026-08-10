import React from "react";
import { generateStructuredData } from "@/lib/seo";

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
export function WebsiteStructuredData() {
  return (
    <StructuredData
      type="website"
      data={{
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: "https://epidom.fr/search?q={search_term_string}",
          },
          "query-input": "required name=search_term_string",
        },
      }}
    />
  );
}

export function OrganizationStructuredData() {
  return (
    <StructuredData
      type="organization"
      data={{
        industry: "Food & Beverage Technology",
        description:
          "Epidom is a free public storefront, online ordering, and POS platform for cafés, restaurants, and warungs, built by Prionation.",
        founder: [
          { "@type": "Person", name: "Evan Cao", jobTitle: "Founder" },
          { "@type": "Person", name: "Darwin Prayoga", jobTitle: "Founder, Prionation" },
        ],
        parentOrganization: { "@type": "Organization", name: "Prionation", url: "https://www.prionation.io" },
      }}
    />
  );
}

export function ProductStructuredData() {
  return (
    <StructuredData
      type="product"
      data={{
        "@type": "SoftwareApplication",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web Browser",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          description: "Free public storefront, digital menu, QR ordering, and online payments.",
        },
        featureList: [
          "Free public online storefront (menu page)",
          "WhatsApp order notifications",
          "Card and local online payments",
          "POS cashier and receipts",
          "Kitchen display system",
          "Staff shift management",
          "Inventory and recipe costing",
          "Multi-outlet finance reporting",
        ],
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
      logo: { "@type": "ImageObject", url: "https://epidom.fr/images/logo.svg" },
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
 * with the visible copy at redesign.faq.q1-q6/a1-a6 (see faq-section.tsx).
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
