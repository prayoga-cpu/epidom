import { generateMetadata } from "@/lib/seo";
import { PrivacyClient } from "./client";
export const metadata = generateMetadata({
  title: "Privacy Policy — EPIDOM",
  description: "How Epidom collects, uses and protects your data.",
  canonical: "https://epidom.fr/privacy",
});
export default function PrivacyPage() {
  return <PrivacyClient />;
}
