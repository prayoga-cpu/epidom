import type { MetadataRoute } from "next";

const BASE_URL = "https://epidom.fr";

const DISALLOW = [
  "/api/",
  "/store/", // authenticated dashboard surface, src/app/(app)/store/[storeId]/**
  "/stores", // authenticated store switcher
  "/admin",
  "/owner",
  "/onboarding",
  "/profile",
  "/checkout", // has order/payment context, no search value
  "/r/", // WhatsApp-receipt short links, src/app/(public)/r/[orderId]
];

/**
 * AI search and assistant crawlers, named so the policy is explicit (they are
 * welcome on the public marketing pages and share the same private paths).
 * A named group replaces "*" for that bot, so the disallow list is repeated.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
