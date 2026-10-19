import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { PartnerDetail } from "@/features/admin/partners/components/partner-detail";

export const metadata = { title: "Partner | Admin | Epidom" };

export default async function AdminPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdminSection("partners");
  const { id } = await params;
  // Payouts and voids move money: full admins only (the API checks it too).
  return <PartnerDetail partnerId={id} canPay={access.full} />;
}
