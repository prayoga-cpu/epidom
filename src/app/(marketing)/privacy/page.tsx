import type { Metadata } from "next";
import { PrivacyClient } from "./client";
export const metadata: Metadata = {
  title: "Privacy Policy — EPIDOM",
  description: "How Epidom collects, uses and protects your data.",
};
export default function PrivacyPage() {
  return <PrivacyClient />;
}
