import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { staffPersonaMayReadFinance } from "@/lib/auth/require-finance-access";
import { getActiveStaffSession } from "@/lib/staff-session";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { FISCAL_PUBLISHER, isFiscalAttestationReady } from "@/lib/fiscal/attestation";
import { loadStoreFiscalContext } from "@/lib/fiscal/journal";
import { isFranceCountry } from "@/lib/fiscal/summary";
import { storeLocalDay } from "@/lib/services/order-queue-number";
import { AttestationDocument } from "@/features/dashboard/fiscal/components/attestation-document";

// Outside the (dashboard) group so it prints without the app around it, like
// finance/print. Same access rule as the Fiscal journal page.
export const dynamic = "force-dynamic";

export default async function FiscalAttestationPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireStaffPageAccess(storeId, "/fiscal");
  const staffSession = await getActiveStaffSession();
  if (staffSession && !staffPersonaMayReadFinance(staffSession, storeId, ["/fiscal"])) {
    redirect(`/store/${staffSession.storeId}/pos`);
  }
  await verifyStoreOwnership(storeId, session.user.id);

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      createdAt: true,
      address: true,
      country: true,
      business: { select: { name: true, address: true, city: true, country: true } },
    },
  });
  // Only a business in France needs it, and only once the publisher's part is complete.
  if (
    !store ||
    !isFiscalAttestationReady() ||
    !isFranceCountry(store.country || store.business.country)
  ) {
    redirect(`/store/${storeId}/fiscal`);
  }

  const [{ timezone }, first] = await Promise.all([
    loadStoreFiscalContext(prisma, storeId),
    prisma.fiscalEntry.findFirst({
      where: { storeId },
      orderBy: { seq: "asc" },
      select: { businessDay: true },
    }),
  ]);
  const address =
    [store.business.address ?? store.address, store.business.city].filter(Boolean).join(", ") ||
    null;

  return (
    <AttestationDocument
      publisher={FISCAL_PUBLISHER}
      issuedOn={storeLocalDay(new Date(), timezone)}
      store={{
        storeId,
        businessName: store.business.name,
        address,
        acquiredOn: storeLocalDay(store.createdAt, timezone),
        firstUseOn: first?.businessDay ?? null,
      }}
    />
  );
}
