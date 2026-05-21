import type React from "react";
import { I18nProvider } from "@/components/lang/i18n-provider";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-orange-200">
        <main className="relative mx-auto min-h-screen bg-white pb-10 shadow-lg">{children}</main>
      </div>
    </I18nProvider>
  );
}
