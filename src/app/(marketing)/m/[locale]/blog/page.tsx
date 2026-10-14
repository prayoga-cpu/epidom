import { BlogClient } from "./client";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";
export const generateMetadata = pageMetadata("blog");
export default async function BlogPage({ params }: LocaleParams) {
  return <BlogClient locale={await routeLocale(params)} />;
}
