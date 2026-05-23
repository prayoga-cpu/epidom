import type React from "react";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { ThemeProvider } from "next-themes";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  );
}
