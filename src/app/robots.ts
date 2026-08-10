import type { MetadataRoute } from "next";

const BASE_URL = "https://epidom.fr";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/store/", // authenticated dashboard surface, src/app/(app)/store/[storeId]/**
          "/stores", // authenticated store switcher
          "/admin",
          "/owner",
          "/onboarding",
          "/profile",
          "/checkout", // has order/payment context, no search value
          "/r/", // WhatsApp-receipt short links, src/app/(public)/r/[orderId]
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
