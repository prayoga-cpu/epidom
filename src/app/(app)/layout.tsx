import type React from "react";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { TimezoneSync } from "@/components/providers/timezone-sync";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <I18nProvider>
      <CurrencyProvider>
        <TimezoneSync />
        {children}
      </CurrencyProvider>
    </I18nProvider>
  );
}
