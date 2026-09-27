import type React from "react";
import { requirePlan } from "@/lib/auth/require-plan";
import { minPlanFor } from "@/lib/plans/entitlements";

// Finance — the single-outlet report and its All outlets roll-up — follows
// FEATURE_MIN_PLAN.finance (redirects below tier).
export default async function FinanceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  await requirePlan(storeId, minPlanFor("finance"));
  return <>{children}</>;
}
