import type { Locale } from "@/components/lang/i18n-provider";
import type { Article } from "@/features/marketing/shared/content/article-types";
import { frPosts } from "./posts.fr";
import { idPosts } from "./posts.id";
import { enPosts } from "./posts.en";

const POSTS_BY_LOCALE: Record<Locale, Article[]> = {
  fr: frPosts,
  id: idPosts,
  en: enPosts,
};

/** Posts for `locale`, newest first — each locale has its own post set (not translated 1:1; see posts.*.ts). */
export function getBlogPosts(locale: Locale): Article[] {
  return [...POSTS_BY_LOCALE[locale]].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** A post by slug within `locale` — a slug is only unique within its own locale's post set. */
export function getBlogPost(locale: Locale, slug: string): Article | undefined {
  return POSTS_BY_LOCALE[locale].find((p) => p.slug === slug);
}

/** Every (locale, slug) pair across all locales — for generateStaticParams / sitemap. */
export function getAllBlogPostParams(): Array<{ locale: Locale; slug: string }> {
  return (Object.keys(POSTS_BY_LOCALE) as Locale[]).flatMap((locale) =>
    POSTS_BY_LOCALE[locale].map((p) => ({ locale, slug: p.slug }))
  );
}
