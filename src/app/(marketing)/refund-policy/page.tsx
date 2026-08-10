import { generateMetadata } from "@/lib/seo";
import { RefundPolicyContent } from "@/features/marketing/refund-policy/components/refund-policy-content";

export const metadata = generateMetadata({
  title: "Refund Policy — EPIDOM",
  description:
    "Read EPIDOM's Refund Policy. Understand our refund and cancellation terms, eligibility criteria, and how to request a refund.",
  canonical: "https://epidom.fr/refund-policy",
});

export default function RefundPolicyPage() {
  return <RefundPolicyContent />;
}
