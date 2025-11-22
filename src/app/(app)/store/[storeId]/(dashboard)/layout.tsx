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

export const metadata: Metadata = {
  title: "Epidom - Admin Dashboard",
  description: "an open source ERP for small food manufacturers",
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
      {/* Minimal top loading bar for visual feedback during navigation */}
      <RouteLoadingIndicator />

      <ErrorBoundary>
        {/* Removed Suspense boundary to enable instant navigation */}
        {/* PageShell (Sidebar + Topbar) persists across routes */}
        {/* Only page content changes, not the entire layout */}
        <CurrencyProvider>
          <I18nProvider>
            <PageShell>{children}</PageShell>
          </I18nProvider>
        </CurrencyProvider>
      </ErrorBoundary>
      <ConditionalAnalytics />
    </div>
  );
}
