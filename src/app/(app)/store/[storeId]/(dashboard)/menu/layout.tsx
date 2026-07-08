import type React from "react";
import { requirePlan } from "@/lib/auth/require-plan";

// The store's menu (MenuItem/MenuCategory) requires the POS plan to manage
// directly from the dashboard; FREE-tier users still edit it via Storefront.
export default async function MenuLayout({
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
