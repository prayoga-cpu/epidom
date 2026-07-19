import type { Metadata } from "next";
import { PartnersClient } from "./client";
export const metadata: Metadata = {
  title: "Partners — EPIDOM",
  description: "Partner with Epidom. Integrations, resellers and white-label programmes.",
};
export default function PartnersPage() {
  return <PartnersClient />;
}
