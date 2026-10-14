import type { Metadata } from "next";
import type { Locale } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { OG_LOCALE, generateMetadata } from "@/lib/seo";
import { landingAlternates } from "./registry";
import type { LandingGroup } from "./registry";
import type { LandingPage } from "./types";
import { ogImageUrl } from "@/features/marketing/seo/og-url";

const SITE = "https://epidom.fr";

/** Absolute URL of a landing page in its own language. */
export function landingUrl(slug: string, locale: Locale): string {
  return `${SITE}${getLocalizedPath(`/${slug}`, locale)}`;
}

/**
 * hreflang for a landing page: its siblings in the same group, each at its OWN
 * slug (the Indonesian page about café POS is not at the English page's path),
 * x-default on the French page, else English, else Indonesian.
 */
export function landingHreflang(group: LandingGroup): Record<string, string> {
  const siblings = landingAlternates(group);
  const languages: Record<string, string> = {};
  for (const locale of ["fr", "id", "en"] as const) {
    const slug = siblings[locale];
    if (slug) languages[locale] = landingUrl(slug, locale);
  }
  const fallback = siblings.fr ? "fr" : siblings.en ? "en" : "id";
  languages["x-default"] = languages[fallback];
  return languages;
}

export function buildLandingMetadata(page: LandingPage): Metadata {
  const canonical = landingUrl(page.slug, page.locale);
  const title = `${page.metaTitle} — EPIDOM`;
  return generateMetadata({
    title,
    description: page.metaDescription,
    canonical,
    alternates: { canonical, languages: landingHreflang(page.group as LandingGroup) },
    openGraph: {
      title: page.h1,
      description: page.metaDescription,
      url: canonical,
      siteName: "EPIDOM",
      locale: OG_LOCALE[page.locale],
      type: "article",
      images: [
        {
          url: ogImageUrl("landing", page.locale, page.slug),
          width: 1200,
          height: 630,
          alt: page.h1,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.h1,
      description: page.metaDescription,
      images: [ogImageUrl("landing", page.locale, page.slug)],
    },
  });
}
