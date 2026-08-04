import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StaffClient } from "@/features/dashboard/staff/components/staff-client";
import { requireOwnerOnly } from "@/lib/auth/require-owner-only";

export default async function StaffPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Only the real owner can manage staff (add/edit/deactivate, set PINs).
  await requireOwnerOnly(storeId);

  return (
    <StaffClient
      storeId={storeId}
      currentUserId={session.user.id}
      currentUserName={session.user.name ?? ""}
      currentUserEmail={session.user.email ?? ""}
    />
  );
}
