import { generateMetadata } from "@/lib/seo";
import { CareersClient } from "./client";
export const metadata = generateMetadata({
  title: "Careers — EPIDOM",
  description: "Join the Epidom team. We're building the free operating system for F&B businesses.",
  canonical: "https://epidom.fr/careers",
});
export default function CareersPage() {
  return <CareersClient />;
}
