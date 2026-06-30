import type React from "react";
import { I18nProvider } from "@/components/lang/i18n-provider";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div className="font-sans min-h-screen bg-background text-foreground antialiased selection:bg-[var(--store-theme,#FF6B35)]/20">
        <main className="relative mx-auto min-h-screen bg-background shadow-lg">{children}</main>
      </div>
    </I18nProvider>
  );
}
