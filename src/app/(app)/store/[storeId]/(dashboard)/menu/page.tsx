import { MenuManager } from "@/features/storefront/editor/components/menu-manager";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";

export default async function MenuPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  await requireStaffPageAccess(storeId, "/menu");
  return <MenuManager storeId={storeId} />;
}
