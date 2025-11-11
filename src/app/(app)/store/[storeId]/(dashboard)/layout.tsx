import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ConditionalAnalytics } from "@/components/analytics/conditional-analytics";
import { Suspense } from "react";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import PageShell from "@/features/dashboard/shared/page-shell";
import { SessionProvider } from "@/components/providers/session-provider";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import LoadingPage from "@/features/loading/loading-page";

export const metadata: Metadata = {
  title: "Epidom - Admin Dashboard",
  description: "an open source ERP for small food manufacturers",
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
      <ErrorBoundary>
        <Suspense fallback={<LoadingPage />}>
          <SessionProvider>
            <CurrencyProvider>
              <I18nProvider>
                <PageShell>{children}</PageShell>
              </I18nProvider>
            </CurrencyProvider>
          </SessionProvider>
        </Suspense>
      </ErrorBoundary>
      <ConditionalAnalytics />
    </div>
  );
}
