import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { CapacityDashboard } from "@/features/admin/components/capacity-dashboard";

export const metadata = { title: "Capacity & Usage | Epidom" };

export default async function CapacityPage() {
  await requireAdminSection("capacity");

  return <CapacityDashboard />;
}
