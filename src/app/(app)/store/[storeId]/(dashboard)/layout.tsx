import type React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConditionalAnalytics } from "@/components/analytics/conditional-analytics";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageShell } from "@/features/dashboard/shared/page-shell";
import { RouteLoadingIndicator } from "@/components/navigation/route-loading-indicator";
import { AlertsPrefetch } from "@/features/dashboard/alerts/components/alerts-prefetch";
import { StoreAccessGate } from "@/features/dashboard/shared/store-access-gate";
import { subscriptionRepository } from "@/lib/repositories/subscription.repository";

export const metadata: Metadata = {
  title: "Epidom — Dashboard",
  description: "Manage your store, orders, menu, inventory, and reports with Epidom.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function Layout({
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

  // FREE/POS plans have no staff feature at all (see /pos's own bypass) —
  // there's no persona to pick, so the gate would just be a pointless extra
  // click for every solo-operator store on those tiers. Same logic applies
  // on OPERATIONS+ if the owner simply hasn't added any staff yet: with
  // nobody but the owner to choose from, the picker has nothing real to
  // offer, so skip straight to the dashboard as Owner instead of an
  // always-the-same-answer click every time the store is opened.
  //
  // The ownership lookup rides along in the same Promise.all rather than
  // gating it — it costs nothing extra in wall-clock time, and it's the one
  // place that can kill the whole stale-store class of 404s at the root: a
  // bookmark, a resumed lastVisitedUrl cookie, a shared link, or a store that
  // was deleted or transferred all arrive here with a storeId this user has
  // no business rendering. Every page below then gets to assume the store is
  // theirs. `userId` is required for it to mean anything — a Prisma relation
  // filter with an undefined field is simply dropped, which would match every
  // store on the platform.
  const [subscription, staffCount, ownedStore] = await Promise.all([
    userId ? subscriptionRepository.findByUserId(userId) : Promise.resolve(null),
    prisma.staffMember.count({ where: { storeId, isActive: true, role: { not: "OWNER" } } }),
    userId
      ? prisma.store.findFirst({
          where: { id: storeId, business: { userId } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (!userId) {
    redirect("/login");
  }
  if (!ownedStore) {
    redirect("/stores");
  }
  const bypassAccessGate =
    subscription?.plan === "FREE" || subscription?.plan === "POS" || staffCount === 0;

  return (
    <div className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
      {/* Skip link for keyboard accessibility */}
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2 focus:ring-2 focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Minimal top loading bar for visual feedback during navigation */}
      <RouteLoadingIndicator />

      <ErrorBoundary>
        {/* Removed Suspense boundary to enable instant navigation */}
        {/* PageShell (Sidebar + Topbar) persists across routes */}
        {/* Only page content changes, not the entire layout */}
        <I18nProvider>
          {/* Prefetch alerts data for sidebar badge */}
          <AlertsPrefetch />
          <StoreAccessGate storeId={storeId} bypassGate={bypassAccessGate}>
            <PageShell>{children}</PageShell>
          </StoreAccessGate>
        </I18nProvider>
      </ErrorBoundary>
      <ConditionalAnalytics />
    </div>
  );
}
