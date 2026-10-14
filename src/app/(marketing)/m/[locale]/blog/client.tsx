import type { Locale } from "@/components/lang/i18n-provider";
import { getBlogPosts } from "@/features/marketing/blog/content";
import { BlogList } from "@/features/marketing/blog/components/blog-list";

export function BlogClient({ locale }: { locale: Locale }) {
  const posts = getBlogPosts(locale);

  return <BlogList locale={locale} posts={posts} />;
}
