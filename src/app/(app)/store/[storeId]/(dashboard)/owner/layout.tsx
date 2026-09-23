import type React from "react";
import { requirePlan } from "@/lib/auth/require-plan";

// Owner (cross-store rollup) requires the ENTERPRISE plan, same gate as
// Finance (redirects below tier).
export default async function OwnerLayout({
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
