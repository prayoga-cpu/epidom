import { AboutPageClient } from "@/features/marketing/about/components/about-page-client";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("about");

export default function AboutPage() {
  return (
    <div className="w-full overflow-x-hidden">
      <AboutPageClient />
    </div>
  );
}
