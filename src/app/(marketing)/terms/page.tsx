import { legalMetadata } from "@/features/marketing/legal/metadata";
import { TermsContent } from "@/features/marketing/terms/components/terms-content";

export const generateMetadata = legalMetadata("terms");

export default function TermsPage() {
  return <TermsContent />;
}
