import type React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePlan } from "@/lib/auth/require-plan";
import { ConditionalAnalytics } from "@/components/analytics/conditional-analytics";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { RouteLoadingIndicator } from "@/components/navigation/route-loading-indicator";
import { StoreAccessGate } from "@/features/dashboard/shared/store-access-gate";
import { OfflineSyncProvider } from "@/features/dashboard/shared/offline-sync-provider";
import { subscriptionRepository } from "@/lib/repositories/subscription.repository";
import { PosStaffGate } from "@/features/pos/components/pos-staff-gate";
import { PosModeShell } from "@/features/pos-mode/pos-mode-shell";
import { verifyStoreAccess } from "@/lib/utils/store-verification";
import { getActiveStaffSession } from "@/lib/staff-session";

export const metadata: Metadata = {
  title: "Epidom — POS",
  description: "Ring up orders, manage the queue, and run the kitchen display.",
  icons: {
    icon: "/favicon.ico",
  },
};

// POS Mode: bottom-tab-bar shell for Cashier/Kitchen (docs/dashboard-revamp.md).
// Mirrors (dashboard)/layout.tsx's session/ownership/gate structure so the POS
// System (/pos, /pos/orders, /pos/kds, /tables) and the Operational page
// (/pos/operational — shift, schedule, clock in/out) all share one gate chain
// instead of each route re-deriving it — see PosStaffGate below for why it
// wraps PosModeShell rather than sitting inside it.
export default async function PosModeLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ storeId: string }>;
}>) {
  const { storeId } = await params;
  const session = await getSession();
  if (session?.user?.deactivatedAt) {
    redirect("/profile");
  }
  const userId = session?.user?.id;

  const [subscription, staffCount, access] = await Promise.all([
    userId ? subscriptionRepository.findByUserId(userId) : Promise.resolve(null),
    prisma.staffMember.count({ where: { storeId, isActive: true, role: { not: "OWNER" } } }),
    userId ? verifyStoreAccess(storeId, userId).catch(() => null) : Promise.resolve(null),
  ]);
  if (!userId) {
    redirect("/login");
  }
  if (!access) {
    redirect("/stores");
  }
  await requirePlan(storeId, "POS");

  // A linked staff account (its own login, StaffMember.userId) is never the
  // owner. The PIN is a real second factor for it: until a PIN persona for
  // THIS account's own staff member exists server-side, nothing under this
  // layout may render — children are not merely hidden by the client gate,
  // they aren't produced, so no page data is streamed to a browser that
  // hasn't passed the PIN. `forcePicker` also stops the gate trusting a stale
  // client-side persona (localStorage) the server no longer agrees with.
  const isLinkedStaff = access.accessType === "staff";
  let personaReady = true;
  if (access.accessType === "staff") {
    const persona = await getActiveStaffSession();
    personaReady =
      !!persona &&
      persona.storeId === storeId &&
      persona.staffMemberId === access.staffMemberId;
  }

  // Same bypass rule (dashboard)/layout.tsx and the old pos/page.tsx each
  // computed separately — FREE/POS plans have no staff feature at all, and a
  // store with the feature but zero staff added yet has nobody but the owner
  // to pick from either way. Shared by both gates below. Never for a linked
  // staff account: its picker is the PIN step, not a convenience.
  const bypassGate =
    !isLinkedStaff &&
    (subscription?.plan === "FREE" || subscription?.plan === "POS" || staffCount === 0);

  return (
    <div className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2 focus:ring-2 focus:outline-none"
      >
        Skip to main content
      </a>

      <RouteLoadingIndicator />

      <ErrorBoundary>
        <I18nProvider>
          <StoreAccessGate
            storeId={storeId}
            bypassGate={bypassGate}
            linkedStaff={isLinkedStaff}
            forcePicker={isLinkedStaff && !personaReady}
          >
            <OfflineSyncProvider>
              {/* Above the shell, not inside it — the status bar/tab bar
                  shouldn't paint a "Kasir"/"Dapur" chrome for an identity
                  nobody's confirmed yet (spec: "first thing rendered, before
                  either Kasir or Dapur loads"). */}
              <PosStaffGate storeId={storeId} bypassGate={bypassGate}>
                <PosModeShell storeId={storeId} linkedStaff={isLinkedStaff}>
                  {personaReady ? children : null}
                </PosModeShell>
              </PosStaffGate>
            </OfflineSyncProvider>
          </StoreAccessGate>
        </I18nProvider>
      </ErrorBoundary>
      <ConditionalAnalytics />
    </div>
  );
}
