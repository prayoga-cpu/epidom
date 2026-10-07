import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyStoreAccess } from "@/lib/utils/store-verification";
import { PosShell } from "@/features/pos/components/pos-shell";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { countTillMenuItems, resolveMenuSetupHref } from "@/lib/pos/till-menu";

export default async function PosPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { store } = await verifyStoreAccess(storeId, session.user.id);
  await requireStaffPageAccess(storeId, "/pos");

  // The till sells from the menu, so an empty one is a dead end: whoever can
  // add the menu is sent to where it's added (Data, or the storefront's Menu
  // tab on a plan without Data). Anyone else gets the till's own empty state,
  // which says who can fill it.
  const [tillItems, menuSetupHref] = await Promise.all([
    countTillMenuItems(store.id, store.customProductsEnabled),
    resolveMenuSetupHref(store.id),
  ]);
  if (tillItems === 0 && menuSetupHref) {
    redirect(menuSetupHref);
  }

  return <PosShell store={{ id: store.id, name: store.name }} menuSetupHref={menuSetupHref} />;
}
