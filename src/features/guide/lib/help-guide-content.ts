import type { Locale } from "@/components/lang/i18n-provider";
import type { Article } from "@/features/marketing/shared/content/article-types";
import { getDocsGuide, getDocsGuides } from "@/features/marketing/docs/content";
import { HELP_GUIDE_SLUGS, POS_GUIDE_IDS, localizedGuideSlug } from "./help-guides";

/**
 * The guide articles themselves, for the Help centre's reader. Kept apart from
 * help-guides.ts (slugs and links only) so a page intro's "Learn more" doesn't
 * pull every article in all three languages into the page.
 */

/** The guide `slug` names (in any language, or its id), in the viewer's language. */
export function resolveHelpGuide(locale: Locale, slug: string): Article | undefined {
  return getDocsGuide(locale, localizedGuideSlug(slug, locale));
}

/**
 * The guides in the order a context lists them: the curated setup-flow order
 * in the Back Office; POS_GUIDE_IDS first ("featured") in POS Mode.
 */
export function orderHelpGuides(
  locale: Locale,
  context: "backoffice" | "pos"
): { featured: Article[]; rest: Article[] } {
  const guides = getDocsGuides(locale);
  if (context === "backoffice") return { featured: [], rest: guides };

  const featured = POS_GUIDE_IDS.map((id) =>
    getDocsGuide(locale, HELP_GUIDE_SLUGS[id][locale])
  ).filter((guide): guide is Article => guide !== undefined);
  const featuredSlugs = new Set(featured.map((guide) => guide.slug));
  return { featured, rest: guides.filter((guide) => !featuredSlugs.has(guide.slug)) };
}
