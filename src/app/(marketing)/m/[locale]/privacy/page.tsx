import { legalMetadata } from "@/features/marketing/legal/metadata";
import { PrivacyContent } from "@/features/marketing/legal/components/privacy-content";

export const generateMetadata = legalMetadata("privacy");

export default function PrivacyPage() {
  return <PrivacyContent />;
}
