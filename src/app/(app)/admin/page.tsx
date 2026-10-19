import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { AdminDashboard } from "@/features/admin/components/admin-dashboard";

export const metadata = { title: "Admin Panel | Epidom" };

export default async function AdminPage() {
  await requireAdminSection("users");

  return <AdminDashboard />;
}
