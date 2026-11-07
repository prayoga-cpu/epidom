import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { requireOwnerOnly } from "@/lib/auth/require-owner-only";
import { requirePlan } from "@/lib/auth/require-plan";
import { CustomerDisplayEditor } from "@/features/pos/components/customer-display-editor";

export const metadata: Metadata = {
  title: "Customer display - Epidom",
  description: "Promo banners, background and thank-you screen for the customer-facing display",
};

// The customer display's look and promo banners. Owner-only, like Settings:
// these are promotions shown to every customer, so no cashier or manager
// persona edits them (the API's PUT enforces the same). On the POS plan,
// which is what puts a customer display at the till in the first place.
export default async function CustomerDisplayPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireOwnerOnly(storeId);
  await requirePlan(storeId, "POS");

  return <CustomerDisplayEditor storeId={storeId} />;
}
