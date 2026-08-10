import { generateMetadata } from "@/lib/seo";
import { GdprClient } from "./client";
export const metadata = generateMetadata({
  title: "GDPR — EPIDOM",
  description: "Epidom's commitment to GDPR compliance and your data rights.",
  canonical: "https://epidom.fr/gdpr",
});
export default function GdprPage() {
  return <GdprClient />;
}
