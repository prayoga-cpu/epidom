import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { LeadsView } from "@/features/admin/components/leads-view";

export const metadata = { title: "Leads | Admin | Epidom" };

export default async function AdminLeadsPage() {
  await requireAdminSection("leads");
  return <LeadsView />;
}
