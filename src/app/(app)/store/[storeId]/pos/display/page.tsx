import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { verifyStoreAccess } from "@/lib/utils/store-verification";
import { requirePlan } from "@/lib/auth/require-plan";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import countryNames from "react-phone-number-input/locale/en.json";
import { PosCustomerDisplay } from "@/features/pos/components/pos-customer-display";
import { getCustomerDisplayConfig } from "@/lib/services/customer-display.service";

// Deliberately outside the (dashboard) route group so it doesn't inherit
// PageShell's sidebar/topbar chrome — this window faces the customer across
// the counter, not the cashier. That also means it sits outside
// (dashboard)/pos/layout.tsx, so the POS plan gate is applied here directly.
// It still inherits I18nProvider and CurrencyProvider from the (app) layout.

// Outside (pos-mode) it gets no "Epidom — POS" title either, and without one
// the tab shows a bare /store/<id>/… URL — indistinguishable from any other
// store's tab when staff are setting up the second screen.
export const metadata: Metadata = {
  title: "Epidom — Customer display",
};

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

  const { store } = await verifyStoreAccess(storeId, session.user.id);
  await requirePlan(storeId, "POS");
  await requireStaffPageAccess(storeId, "/pos");

  // The store's own look and promo banners (Store Dashboard → Customer display),
  // over branding reused from the storefront rather than duplicated onto the
  // store — same reasoning as StoreReceiptSettings. A store that never saved
  // any gets the defaults: the storefront's logo and colour, no banners.
  const config = await getCustomerDisplayConfig(storeId);

  return (
    <PosCustomerDisplay
      storeId={storeId}
      initialConfig={config}
      defaultCountry={resolveCountryCode(store.country)}
    />
  );
}
