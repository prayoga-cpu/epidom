import type React from "react";
import { requirePlan } from "@/lib/auth/require-plan";

// Custom Development requires the ENTERPRISE plan (redirects below tier).
export default async function CustomDevelopmentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  await requirePlan(storeId, "ENTERPRISE");
  return <>{children}</>;
}
