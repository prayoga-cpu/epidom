import type React from "react";
import { I18nProvider } from "@/components/lang/i18n-provider";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <I18nProvider>{children}</I18nProvider>;
}
