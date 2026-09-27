import type React from "react";
import { requirePlan } from "@/lib/auth/require-plan";
import { minPlanFor } from "@/lib/plans/entitlements";

// Custom Development is open to every paying plan — it is where an Enterprise
// build starts (see FEATURE_MIN_PLAN.customDevelopment).
export default async function CustomDevelopmentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  await requirePlan(storeId, minPlanFor("customDevelopment"));
  return <>{children}</>;
}
