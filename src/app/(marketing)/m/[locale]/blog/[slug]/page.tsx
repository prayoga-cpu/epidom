import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { toLocale } from "@/features/marketing/seo/route-locale";
import { BREADCRUMB_LABELS, buildBreadcrumbs, buildLocalizedMetadata } from "@/lib/seo";
import { getBlogPost, getBlogPosts } from "@/features/marketing/blog/content";
import { BlogPostView } from "@/features/marketing/blog/components/blog-post-view";
import {
  BlogPostingStructuredData,
  BreadcrumbStructuredData,
} from "@/components/seo/structured-data";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

/** Each language prerenders its own posts (slugs differ per language). */
export function generateStaticParams({ params }: { params: { locale: string } }) {
  return getBlogPosts(toLocale(params.locale)).map((post) => ({ slug: post.slug }));
}

export const dynamicParams = false;

async function resolvePost(params: PageProps["params"]) {
  const { locale: raw, slug } = await params;
  const locale = toLocale(raw);
  return { locale, slug, post: getBlogPost(locale, slug) };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug, post } = await resolvePost(params);

  if (!post) return { title: "Not found | Epidom" };

  // Posts are written per locale and their slugs differ (getBlogPost has no
  // cross-locale fallback), so an article exists at exactly one URL. Authored in
  // [locale] only: hreflang claims that URL and nothing else, instead of the
  // /id and /en siblings that would 404.
  return buildLocalizedMetadata({
    basePath: `/blog/${slug}`,
    locale,
    title: `${post.title} — EPIDOM`,
    description: post.description,
    ogTitle: post.title,
    authoredLocales: [locale],
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { locale, slug, post } = await resolvePost(params);

  if (!post) notFound();

  const canonical = `https://epidom.fr${getLocalizedPath(`/blog/${slug}`, locale)}`;

  return (
    <div className="w-full overflow-x-hidden">
      <BlogPostingStructuredData
        url={canonical}
        title={post.title}
        description={post.description}
        datePublished={post.date}
        dateModified={post.updated}
      />
      <BreadcrumbStructuredData
        items={buildBreadcrumbs(locale, [
          { name: BREADCRUMB_LABELS[locale].blog, path: "/blog" },
          { name: post.title, path: `/blog/${slug}` },
        ])}
      />
      <BlogPostView locale={locale} post={post} />
    </div>
  );
}
