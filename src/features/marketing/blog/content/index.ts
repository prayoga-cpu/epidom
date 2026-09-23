import type { Locale } from "@/components/lang/i18n-provider";
import type { BlogPost } from "./types";
import { frPosts } from "./posts.fr";
import { idPosts } from "./posts.id";
import { enPosts } from "./posts.en";

export type { BlogAuthor, BlogPost } from "./types";

const POSTS_BY_LOCALE: Record<Locale, BlogPost[]> = {
  fr: frPosts,
  id: idPosts,
  en: enPosts,
};

/** Posts for `locale`, newest first — each locale has its own post set (not translated 1:1; see posts.*.ts). */
export function getBlogPosts(locale: Locale): BlogPost[] {
  return [...POSTS_BY_LOCALE[locale]].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** A post by slug within `locale` — a slug is only unique within its own locale's post set. */
export function getBlogPost(locale: Locale, slug: string): BlogPost | undefined {
  return POSTS_BY_LOCALE[locale].find((p) => p.slug === slug);
}

/** Every (locale, slug) pair across all locales — for generateStaticParams / sitemap. */
export function getAllBlogPostParams(): Array<{ locale: Locale; slug: string }> {
  return (Object.keys(POSTS_BY_LOCALE) as Locale[]).flatMap((locale) =>
    POSTS_BY_LOCALE[locale].map((p) => ({ locale, slug: p.slug }))
  );
}
