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

// Predefined structured data components
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
        founder: {
          "@type": "Person",
          name: "EPIDOM Team",
        },
        numberOfEmployees: "10-50",
        industry: "Food Technology",
        description:
          "EPIDOM is a leading provider of food inventory management solutions for restaurants, cafes, and food service businesses.",
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
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.8",
          reviewCount: "150",
        },
        featureList: [
          "Real-time inventory tracking",
          "Waste reduction analytics",
          "Automated reorder alerts",
          "Multi-location support",
          "Mobile app access",
          "Integration with POS systems",
        ],
      }}
    />
  );
}
