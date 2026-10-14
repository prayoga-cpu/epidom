import type { Locale } from "@/components/lang/i18n-provider";

/** Which kind of page a share image belongs to (src/app/og/[kind]/[locale]/[slug]). */
export type OgKind = "landing" | "blog" | "compare";

/** Absolute URL of a page's own share image (1200×630, prerendered). */
export function ogImageUrl(kind: OgKind, locale: Locale, slug: string): string {
  return `https://epidom.fr/og/${kind}/${locale}/${slug}`;
}
