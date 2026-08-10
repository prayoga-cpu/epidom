import { generateMetadata } from "@/lib/seo";
import { StatusClient } from "./client";
export const metadata = generateMetadata({
  title: "Status — EPIDOM",
  description: "Live status of Epidom services and infrastructure.",
  canonical: "https://epidom.fr/status",
});
export default function StatusPage() {
  return <StatusClient />;
}
