import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { AdminCustomDevelopmentTable } from "@/features/admin/components/admin-custom-development-table";

export const metadata = { title: "Custom Development | Admin | Epidom" };

export default async function AdminCustomDevelopmentPage() {
  await requireAdminSection("custom-development");

  return <AdminCustomDevelopmentTable />;
}
