/**
 * Terms and Conditions Page
 *
 * Legal terms and conditions for EPIDOM service usage.
 * Displays comprehensive terms of service with multilanguage support.
 *
 * @page
 */

import { generateMetadata as genMeta } from "@/lib/seo";
import { TermsContent } from "@/features/marketing/terms/components/terms-content";

export const metadata = genMeta({
  title: "Terms and Conditions - EPIDOM",
  description:
    "Read EPIDOM's Terms and Conditions. Understand the terms of service, user responsibilities, and legal agreements for using our food inventory management platform.",
  keywords: [
    "terms and conditions",
    "terms of service",
    "EPIDOM legal",
    "user agreement",
    "service terms",
  ],
  openGraph: {
    title: "Terms and Conditions - EPIDOM",
    description: "Read EPIDOM's Terms and Conditions and understand the terms of service.",
    url: "https://epidom.com/terms",
  },
});

export default function TermsPage() {
  return (
    <main className="w-full overflow-x-hidden bg-white pt-24 md:pt-28">
      <div className="animate-slide-up">
        <TermsContent />
      </div>
    </main>
  );
}

