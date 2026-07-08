import type React from "react";
import { requirePlan } from "@/lib/auth/require-plan";

// Gates /pos, /pos/orders and /pos/kds behind the POS plan (redirects below tier).
export default async function PosLayout({
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
