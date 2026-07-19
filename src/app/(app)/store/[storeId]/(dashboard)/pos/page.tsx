import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { PosShell } from "@/features/pos/components/pos-shell";
import { subscriptionRepository } from "@/lib/repositories/subscription.repository";

export default async function PosPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const store = await verifyStoreOwnership(storeId, session.user.id);
  const subscription = await subscriptionRepository.findByUserId(session.user.id);

  // If plan is FREE or POS, they don't have access to staff management (OPERATIONS/ENTERPRISE feature).
  // So we bypass the staff gate.
  const bypassStaffGate = subscription?.plan === "FREE" || subscription?.plan === "POS";

  return <PosShell store={{ id: store.id, name: store.name }} bypassStaffGate={bypassStaffGate} />;
}
