import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ConditionalAnalytics } from "@/components/analytics/conditional-analytics";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageShell } from "@/features/dashboard/shared/page-shell";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { RouteLoadingIndicator } from "@/components/navigation/route-loading-indicator";
import { AlertsPrefetch } from "@/features/dashboard/alerts/components/alerts-prefetch";

export const metadata: Metadata = {
  title: "Epidom — Dashboard",
  description: "Manage your store, orders, menu, inventory, and reports with Epidom.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <CurrencyProvider>
          <I18nProvider>
            {/* Prefetch alerts data for sidebar badge */}
            <AlertsPrefetch />
            <PageShell>{children}</PageShell>
          </I18nProvider>
        </CurrencyProvider>
      </ErrorBoundary>
      <ConditionalAnalytics />
    </div>
  );
}

