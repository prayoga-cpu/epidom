import { generateMetadata } from "@/lib/seo";
import { CookiePolicyClient } from "./client";
export const metadata = generateMetadata({
  title: "Cookie Policy — EPIDOM",
  description: "How and why Epidom uses cookies on its website.",
  canonical: "https://epidom.fr/cookie-policy",
});
export default function CookiePolicyPage() {
  return <CookiePolicyClient />;
}
