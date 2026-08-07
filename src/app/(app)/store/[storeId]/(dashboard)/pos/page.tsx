import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { PosShell } from "@/features/pos/components/pos-shell";
import { subscriptionRepository } from "@/lib/repositories/subscription.repository";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";

export default async function PosPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const store = await verifyStoreOwnership(storeId, session.user.id);
  await requireStaffPageAccess(storeId, "/pos");
  const [subscription, staffCount] = await Promise.all([
    subscriptionRepository.findByUserId(session.user.id),
    prisma.staffMember.count({ where: { storeId, isActive: true, role: { not: "OWNER" } } }),
  ]);

  // If plan is FREE or POS, they don't have access to staff management
  // (OPERATIONS/ENTERPRISE feature). Same outcome if the plan supports staff
  // but none have been added yet — mirrors the (dashboard) layout's own
  // StoreAccessGate bypass, so a zero-staff store doesn't skip that gate
  // only to land on this one's own "no staff, continue as Owner" screen.
  const bypassStaffGate =
    subscription?.plan === "FREE" || subscription?.plan === "POS" || staffCount === 0;

  return <PosShell store={{ id: store.id, name: store.name }} bypassStaffGate={bypassStaffGate} />;
}
