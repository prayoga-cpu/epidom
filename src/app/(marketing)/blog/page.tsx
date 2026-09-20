import { BlogClient } from "./client";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";
export const generateMetadata = pageMetadata("blog");
export default function BlogPage() {
  return <BlogClient />;
}
