import type React from "react";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { CurrencyProvider } from "@/components/providers/currency-provider";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <I18nProvider>
      <CurrencyProvider>{children}</CurrencyProvider>
    </I18nProvider>
  );
}
