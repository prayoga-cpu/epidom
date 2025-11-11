/**
 * Refund Policy Page
 *
 * Refund and cancellation policy for EPIDOM subscriptions.
 * Displays comprehensive refund policy with multilanguage support.
 *
 * @page
 */

import { generateMetadata as genMeta } from "@/lib/seo";
import { RefundPolicyContent } from "@/features/marketing/refund-policy/components/refund-policy-content";

export const metadata = genMeta({
  title: "Refund Policy - EPIDOM",
  description:
    "Read EPIDOM's Refund Policy. Understand our refund and cancellation terms, eligibility criteria, and how to request a refund for your subscription.",
  keywords: [
    "refund policy",
    "cancellation policy",
    "EPIDOM refund",
    "subscription refund",
    "money back guarantee",
  ],
  openGraph: {
    title: "Refund Policy - EPIDOM",
    description: "Read EPIDOM's Refund Policy and understand our refund and cancellation terms.",
    url: "https://epidom.com/refund-policy",
  },
});

export default function RefundPolicyPage() {
  return (
    <main
      className="min-h-screen bg-white pt-24 md:pt-32"
      style={{ color: "var(--color-brand-primary)" }}
    >
      <div className="animate-slide-up">
        <RefundPolicyContent />
      </div>
    </main>
  );
}

