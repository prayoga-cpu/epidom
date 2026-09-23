import { legalMetadata } from "@/features/marketing/legal/metadata";
import { RefundPolicyContent } from "@/features/marketing/refund-policy/components/refund-policy-content";

export const generateMetadata = legalMetadata("refund-policy");

export default function RefundPolicyPage() {
  return <RefundPolicyContent />;
}
