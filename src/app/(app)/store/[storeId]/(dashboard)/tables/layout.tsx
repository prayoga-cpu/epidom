import type React from "react";
import { requirePlan } from "@/lib/auth/require-plan";

// Tables (and table reservations) require the POS plan.
export default async function TablesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  await requirePlan(storeId, "POS");
  return <>{children}</>;
}
