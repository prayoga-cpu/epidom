import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALE_HEADER, DEFAULT_LOCALE, getLocalizedPath } from "@/lib/i18n-routing";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getBlogPost } from "@/features/marketing/blog/content";
import { BlogPostView } from "@/features/marketing/blog/components/blog-post-view";
import { BlogPostingStructuredData } from "@/components/seo/structured-data";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function resolvePost(slug: string) {
  const headersList = await headers();
  const locale = (headersList.get(LOCALE_HEADER) as Locale | null) ?? DEFAULT_LOCALE;
  const post = getBlogPost(locale, slug);
  return { locale, post };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { locale, post } = await resolvePost(slug);

  if (!post) return { title: "Not found | Epidom" };

  const canonical = `https://epidom.fr${getLocalizedPath(`/blog/${slug}`, locale)}`;
  return buildMetadata({
    title: `${post.title} — EPIDOM`,
    description: post.description,
    canonical,
    openGraph: { title: post.title, description: post.description, url: canonical },
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const { locale, post } = await resolvePost(slug);

  if (!post) notFound();

  const canonical = `https://epidom.fr${getLocalizedPath(`/blog/${slug}`, locale)}`;

  return (
    <main className="w-full overflow-x-hidden">
      <BlogPostingStructuredData
        url={canonical}
        title={post.title}
        description={post.description}
        datePublished={post.date}
      />
      <BlogPostView locale={locale} post={post} />
    </main>
  );
}
