import { PressClient } from "./client";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";
export const generateMetadata = pageMetadata("press");
export default function PressPage() {
  return <PressClient />;
}
