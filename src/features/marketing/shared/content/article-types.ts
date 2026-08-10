import type { Locale } from "@/components/lang/i18n-provider";

/**
 * Shared structured-content model for blog posts and docs guides — plain
 * data instead of MDX (no MDX/contentlayer dependency in this repo) so
 * adding an article is just adding an entry to a content array, and the
 * renderer (article-body.tsx) stays the single place that turns it into
 * on-brand JSX.
 */
export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string; attribution?: string };

export interface Article {
  slug: string;
  locale: Locale;
  title: string;
  description: string;
  date: string; // ISO
  readMinutes: number;
  category: string;
  blocks: ArticleBlock[];
}
