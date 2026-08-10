import type { Locale } from "@/components/lang/i18n-provider";
import type { Article } from "@/features/marketing/shared/content/article-types";
import { frGuides } from "./guides.fr";
import { idGuides } from "./guides.id";
import { enGuides } from "./guides.en";

const GUIDES_BY_LOCALE: Record<Locale, Article[]> = {
  fr: frGuides,
  id: idGuides,
  en: enGuides,
};

/** Guides for `locale`, in curated (setup-flow) order — not date-sorted, unlike blog. */
export function getDocsGuides(locale: Locale): Article[] {
  return GUIDES_BY_LOCALE[locale];
}

export function getDocsGuide(locale: Locale, slug: string): Article | undefined {
  return GUIDES_BY_LOCALE[locale].find((g) => g.slug === slug);
}

export function getAllDocsParams(): Array<{ locale: Locale; slug: string }> {
  return (Object.keys(GUIDES_BY_LOCALE) as Locale[]).flatMap((locale) =>
    GUIDES_BY_LOCALE[locale].map((g) => ({ locale, slug: g.slug }))
  );
}
