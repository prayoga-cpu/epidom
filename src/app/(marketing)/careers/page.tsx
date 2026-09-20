import { CareersClient } from "./client";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";
export const generateMetadata = pageMetadata("careers");
export default function CareersPage() {
  return <CareersClient />;
}
