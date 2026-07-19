import type { Metadata } from "next";
import { CookiePolicyClient } from "./client";
export const metadata: Metadata = {
  title: "Cookie Policy — EPIDOM",
  description: "How and why Epidom uses cookies on its website.",
};
export default function CookiePolicyPage() {
  return <CookiePolicyClient />;
}
