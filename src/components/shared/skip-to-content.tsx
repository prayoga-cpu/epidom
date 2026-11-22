"use client";

import { useI18n } from "@/components/lang/i18n-provider";

/**
 * Keyboard "skip to main content" link. Client component so the label follows
 * the visitor's language; render it inside the I18nProvider, as the first
 * focusable element of the shell.
 */
export function SkipToContent() {
  const { t } = useI18n();
  return (
    <a
      href="#main-content"
      className="focus:bg-primary focus:text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2 focus:ring-2 focus:outline-none"
    >
      {t("uiText.common.skipToContent")}
    </a>
  );
}
