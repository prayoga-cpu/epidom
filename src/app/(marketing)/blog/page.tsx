import { generateMetadata } from "@/lib/seo";
import { BlogClient } from "./client";
export const metadata = generateMetadata({
  title: "Blog — EPIDOM",
  description:
    "Guides, stories and tips for warung, café, and restaurant owners on running a smarter F&B business.",
  keywords: ["epidom blog", "tips warung", "f&b business tips indonesia"],
  canonical: "https://epidom.fr/blog",
});
export default function BlogPage() {
  return <BlogClient />;
}
