import { redirect } from "next/navigation";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";

// The standalone menu editor is retired — Storefront's Menu tab renders the
// exact same MenuManager tree and, unlike this page, was never POS-tier
// gated (FREE-tier users already relied on it as their only real path to
// publish a menu — see docs/back-office-revamp.md). No plan gate here
// either, for the same reason: a FREE-tier bookmark to /menu must still
// resolve, not bounce to /pricing before ever reaching the redirect.
export default async function MenuPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  // Either grant still works — a staffer holding only the narrower "/menu"
  // permission (see grantableOnlyNavItems) is unaffected by the merge.
  await requireStaffPageAccess(storeId, ["/menu", "/storefront"]);
  redirect(`/store/${storeId}/storefront?tab=menu`);
}
