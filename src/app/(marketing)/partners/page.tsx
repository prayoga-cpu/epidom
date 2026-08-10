import { generateMetadata } from "@/lib/seo";
import { PartnersClient } from "./client";
export const metadata = generateMetadata({
  title: "Partners — EPIDOM",
  description: "Partner with Epidom. Integrations, resellers and white-label programmes.",
  canonical: "https://epidom.fr/partners",
});
export default function PartnersPage() {
  return <PartnersClient />;
}
