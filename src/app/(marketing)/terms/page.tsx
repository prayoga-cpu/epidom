import { generateMetadata } from "@/lib/seo";
import { TermsContent } from "@/features/marketing/terms/components/terms-content";

export const metadata = generateMetadata({
  title: "Terms & Conditions — EPIDOM",
  description:
    "Read EPIDOM's Terms and Conditions. Understand the terms of service, user responsibilities, and legal agreements.",
  canonical: "https://epidom.fr/terms",
});

export default function TermsPage() {
  return <TermsContent />;
}
