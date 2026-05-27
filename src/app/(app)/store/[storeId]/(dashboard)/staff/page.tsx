import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StaffClient } from "@/features/dashboard/staff/components/staff-client";

export default async function StaffPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <StaffClient
      storeId={storeId}
      currentUserId={session.user.id}
      currentUserName={session.user.name ?? ""}
      currentUserEmail={session.user.email ?? ""}
    />
  );
}
