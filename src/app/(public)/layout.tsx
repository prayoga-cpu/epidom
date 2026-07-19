import type React from "react";
import { I18nProvider } from "@/components/lang/i18n-provider";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div className="bg-background text-foreground min-h-screen font-sans antialiased selection:bg-[var(--store-theme,#FF6B35)]/20">
        <main className="bg-background relative mx-auto min-h-screen shadow-lg">{children}</main>
      </div>
    </I18nProvider>
  );
}
