import { StatusClient } from "./client";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";
export const generateMetadata = pageMetadata("status");
export default function StatusPage() {
  return <StatusClient />;
}
