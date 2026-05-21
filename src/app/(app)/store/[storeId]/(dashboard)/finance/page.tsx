import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceClient } from "@/features/dashboard/finance/components/finance-client";

export default async function FinancePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return <FinanceClient storeId={storeId} />;
}
