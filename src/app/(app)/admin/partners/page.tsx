import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { PartnersAdmin } from "@/features/admin/partners/components/partners-admin";

export const metadata = { title: "Partners | Admin | Epidom" };

export default async function AdminPartnersPage() {
  await requireAdminSection("partners");
  return <PartnersAdmin />;
}
