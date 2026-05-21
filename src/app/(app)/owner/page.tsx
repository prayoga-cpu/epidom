import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OwnerDashboardClient } from "@/features/dashboard/owner/components/owner-dashboard-client";

export default async function OwnerPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return <OwnerDashboardClient />;
}
