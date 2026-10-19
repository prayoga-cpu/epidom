import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { AdminActivityLog } from "@/features/admin/components/admin-activity-log";

export const metadata = { title: "Activity | Admin | Epidom" };

export default async function AdminActivityPage() {
  await requireAdminSection("activity");

  return <AdminActivityLog />;
}
