import type React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function FinanceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  return <>{children}</>;
}
