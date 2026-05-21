import type React from "react";
import { requirePlan } from "@/lib/auth/require-plan";

export default async function TrackingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  await requirePlan(storeId, "OPERATIONS");
  return <>{children}</>;
}
