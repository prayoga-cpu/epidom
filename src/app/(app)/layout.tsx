import type React from "react";
import { Suspense } from "react";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { TimezoneSync } from "@/components/providers/timezone-sync";
import { LastVisitedTracker } from "@/components/providers/last-visited-tracker";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <I18nProvider>
      <CurrencyProvider>
        <TimezoneSync />
        {/* useSearchParams() requires a Suspense boundary */}
        <Suspense fallback={null}>
          <LastVisitedTracker />
        </Suspense>
        {children}
      </CurrencyProvider>
    </I18nProvider>
  );
}
