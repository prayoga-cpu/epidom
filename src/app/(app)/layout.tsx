import type React from "react";
import { Suspense } from "react";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { TimezoneSync } from "@/components/providers/timezone-sync";
import { LastVisitedTracker } from "@/components/providers/last-visited-tracker";
import { PwaInstall } from "@/components/pwa/pwa-install";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <I18nProvider>
      <CurrencyProvider>
        <TimezoneSync />
        {/* One `<pwa-install>` for the whole app surface. Mounted here rather
            than in the root layout because its `description` is translated, and
            I18nProvider starts here — and because every install button lives
            under this layout anyway. */}
        <PwaInstall />
        {/* useSearchParams() requires a Suspense boundary */}
        <Suspense fallback={null}>
          <LastVisitedTracker />
        </Suspense>
        {children}
      </CurrencyProvider>
    </I18nProvider>
  );
}
