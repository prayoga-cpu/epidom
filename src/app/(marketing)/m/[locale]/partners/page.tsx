import { PartnersClient } from "./client";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";
export const generateMetadata = pageMetadata("partners");
export default function PartnersPage() {
  return <PartnersClient />;
}
