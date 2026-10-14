"use client";

import type React from "react";
import { useI18n } from "@/components/lang/i18n-provider";

/**
 * Marks the storefront's content with the language it is shown in: the
 * store's on the server, the visitor's once their preference applies. The
 * root <html lang> can't know a store's language when the server renders
 * it (it is set from the URL, and /@slug carries none), so the attribute sits
 * here, where screen readers and crawlers read it for everything inside.
 */
export function StoreLanguage({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n();
  return (
    <div lang={locale} className="contents">
      {children}
    </div>
  );
}
