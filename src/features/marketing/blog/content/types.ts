import type { Article } from "@/features/marketing/shared/content/article-types";

/**
 * A real, named author. Optional on a post: when it is absent the byline
 * falls back to the localized "Epidom Team" identity with the brand mark as
 * the avatar (see blog-byline.tsx). Only add one for a person who actually
 * wrote the piece and agreed to be credited; `photoSrc` is a site-relative
 * path (e.g. "/images/authors/name.jpg") or an absolute image URL.
 */
export interface BlogAuthor {
  name: string;
  role?: string;
  photoSrc?: string;
}

/** A blog post: the shared Article shape plus an optional author. */
export interface BlogPost extends Article {
  author?: BlogAuthor;
  /**
   * ISO date of the last real revision (rewrite, correction), when it differs
   * from `date`. Feeds the sitemap's lastModified and BlogPosting dateModified.
   */
  updated?: string;
  /**
   * Slugs of landing pages in the post's own language (calculators, guides —
   * src/features/marketing/landing/registry.ts), linked under the article.
   */
  related?: string[];
}
