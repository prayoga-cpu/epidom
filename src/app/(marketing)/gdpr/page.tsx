import { legalMetadata } from "@/features/marketing/legal/metadata";
import { GdprContent } from "@/features/marketing/legal/components/gdpr-content";

export const generateMetadata = legalMetadata("gdpr");

export default function GdprPage() {
  return <GdprContent />;
}
