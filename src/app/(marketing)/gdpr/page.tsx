import type { Metadata } from "next";
import { GdprClient } from "./client";
export const metadata: Metadata = {
  title: "GDPR — EPIDOM",
  description: "Epidom's commitment to GDPR compliance and your data rights.",
};
export default function GdprPage() {
  return <GdprClient />;
}
