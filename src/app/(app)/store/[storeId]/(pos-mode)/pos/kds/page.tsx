import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyStoreAccess } from "@/lib/utils/store-verification";
import { KdsShell } from "@/features/pos/components/kds/kds-shell";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { getActiveStaffSession } from "@/lib/staff-session";
import { PageIntro } from "@/features/guide/components/page-intro";

export const metadata = { title: "Kitchen & Bar | Epidom" };

export default async function KdsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  await verifyStoreAccess(storeId, session.user.id);
  await requireStaffPageAccess(storeId, "/pos/kds");

  // No active staff session at all means the real owner is browsing —
  // always allowed to flip the on/off toggle. A staff PIN session may have
  // this page in its allowedPages without being the OWNER role, and that
  // should still not be able to change this store-wide operational mode.
  const staffSession = await getActiveStaffSession();
  const canManageSettings =
    !staffSession || staffSession.storeId !== storeId || staffSession.role === "OWNER";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageIntro
        id="kitchen"
        variant="compact"
        storeId={storeId}
        className="mx-3 mt-2 shrink-0 sm:mx-6"
      />
      {/* KdsShell is h-full: without this min-h-0 box it stays the page's full
          height under the intro, and overflow-hidden clips the bottom of the
          last ticket in a busy column (it scrolls inside the shell's box). */}
      <div className="flex min-h-0 flex-1 flex-col">
        <KdsShell storeId={storeId} canManageSettings={canManageSettings} />
      </div>
    </div>
  );
}
