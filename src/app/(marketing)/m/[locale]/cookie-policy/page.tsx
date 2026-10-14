import { legalMetadata } from "@/features/marketing/legal/metadata";
import { CookiePolicyContent } from "@/features/marketing/legal/components/cookie-policy-content";

export const generateMetadata = legalMetadata("cookie-policy");

export default function CookiePolicyPage() {
  return <CookiePolicyContent />;
}
