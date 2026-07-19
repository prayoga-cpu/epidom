import type { Metadata } from "next";
import { TermsContent } from "@/features/marketing/terms/components/terms-content";

export const metadata: Metadata = {
  title: "Terms & Conditions — EPIDOM",
  description:
    "Read EPIDOM's Terms and Conditions. Understand the terms of service, user responsibilities, and legal agreements.",
};

export default function TermsPage() {
  return <TermsContent />;
}
