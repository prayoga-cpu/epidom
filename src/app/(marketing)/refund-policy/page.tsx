import type { Metadata } from "next";
import { RefundPolicyContent } from "@/features/marketing/refund-policy/components/refund-policy-content";

export const metadata: Metadata = {
  title: "Refund Policy — EPIDOM",
  description: "Read EPIDOM's Refund Policy. Understand our refund and cancellation terms, eligibility criteria, and how to request a refund.",
};

export default function RefundPolicyPage() {
  return <RefundPolicyContent />;
}
