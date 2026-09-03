import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { requirePlan } from "@/lib/auth/require-plan";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import countryNames from "react-phone-number-input/locale/en.json";
import { PosCustomerDisplay } from "@/features/pos/components/pos-customer-display";

// Deliberately outside the (dashboard) route group so it doesn't inherit
// PageShell's sidebar/topbar chrome — this window faces the customer across
// the counter, not the cashier. That also means it sits outside
// (dashboard)/pos/layout.tsx, so the POS plan gate is applied here directly.
// It still inherits I18nProvider and CurrencyProvider from the (app) layout.


/**
 * `Store.country` is free text — it is matched elsewhere with `/indonesia/i`
 * (see inferMarket in payment-fees.config.ts), not stored as ISO-2. The phone
 * pad needs a real country code to preselect a dial code, so resolve the name
 * here on the server and hand the client a clean one. Falls back to "ID",
 * the same default the cashier's own phone field already uses.
 */
function resolveCountryCode(country: string | null | undefined): string {
  const raw = (country ?? "").trim();
  if (!raw) return "ID";

  const names = countryNames as Record<string, string>;
  if (/^[A-Za-z]{2}$/.test(raw) && names[raw.toUpperCase()]) return raw.toUpperCase();

  const match = Object.entries(names).find(
    ([, name]) => name.toLowerCase() === raw.toLowerCase()
  );
  return match ? match[0] : "ID";
}

export default async function PosCustomerDisplayPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const store = await verifyStoreOwnership(storeId, session.user.id);
  await requirePlan(storeId, "POS");
  await requireStaffPageAccess(storeId, "/pos");

  // Branding is reused from the storefront rather than duplicated onto the
  // store — same reasoning as StoreReceiptSettings. A store with no published
  // storefront falls back to its own name and the Epidom mark.
  const storefront = await prisma.storefront.findUnique({
    where: { storeId },
    select: { displayName: true, logoUrl: true, themeColor: true },
  });

  return (
    <PosCustomerDisplay
      storeId={storeId}
      storeName={storefront?.displayName || store.name}
      logoUrl={storefront?.logoUrl ?? store.image ?? null}
      themeColor={storefront?.themeColor ?? null}
      defaultCountry={resolveCountryCode(store.country)}
    />
  );
}
