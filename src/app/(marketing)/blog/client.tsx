import { headers } from "next/headers";
import type { Locale } from "@/components/lang/i18n-provider";
import { LOCALE_HEADER, DEFAULT_LOCALE } from "@/lib/i18n-routing";
import { getBlogPosts } from "@/features/marketing/blog/content";
import { BlogList } from "@/features/marketing/blog/components/blog-list";

export async function BlogClient() {
  const headersList = await headers();
  const locale = (headersList.get(LOCALE_HEADER) as Locale | null) ?? DEFAULT_LOCALE;
  const posts = getBlogPosts(locale);

  return <BlogList locale={locale} posts={posts} />;
}
