import type { Metadata } from "next";
import { CareersClient } from "./client";
export const metadata: Metadata = {
  title: "Careers — EPIDOM",
  description: "Join the Epidom team. We're building the future of F&B operations.",
};
export default function CareersPage() {
  return <CareersClient />;
}
