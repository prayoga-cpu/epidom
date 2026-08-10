import { generateMetadata } from "@/lib/seo";
import { PressClient } from "./client";
export const metadata = generateMetadata({
  title: "Press — EPIDOM",
  description: "Media kit, press releases and contact for journalists covering Epidom.",
  canonical: "https://epidom.fr/press",
});
export default function PressPage() {
  return <PressClient />;
}
