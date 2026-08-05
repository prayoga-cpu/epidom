import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StaffClient } from "@/features/dashboard/staff/components/staff-client";
import { requireOwnerOnly } from "@/lib/auth/require-owner-only";
import { prisma } from "@/lib/prisma";
import { getTimezoneOffsetLabel } from "@/lib/utils/timezone";

export default async function StaffPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Only the real owner can manage staff (add/edit/deactivate, set PINs).
  await requireOwnerOnly(storeId);

  // Staff/Owner PIN sessions expire at midnight in the store's business
  // timezone (see src/lib/staff-session.ts) — shown on the security notice
  // below so the stated cutoff matches the clock actually enforcing it,
  // rather than implying the viewer's own browser timezone.
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { business: { select: { timezone: true } } },
  });
  const storeTimeZoneLabel = getTimezoneOffsetLabel(store?.business.timezone ?? "UTC");

  return (
    <StaffClient
      storeId={storeId}
      currentUserId={session.user.id}
      currentUserName={session.user.name ?? ""}
      currentUserEmail={session.user.email ?? ""}
      storeTimeZoneLabel={storeTimeZoneLabel}
    />
  );
}
