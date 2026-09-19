import type React from "react";
import { requirePlan } from "@/lib/auth/require-plan";

export default async function CustomersLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  // Capturing a customer is POS-tier. Only the promotion mechanics (presets,
  // coupons, points) are OPERATIONS — those are gated where they live.
  await requirePlan(storeId, "POS");
  return <>{children}</>;
}
