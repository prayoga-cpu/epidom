import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { RevenueDashboard } from "@/features/admin/components/revenue-dashboard";

export const metadata = { title: "Revenue Report | Epidom" };

export default async function RevenuePage() {
  await requireAdminSection("revenue");

  return <RevenueDashboard />;
}
