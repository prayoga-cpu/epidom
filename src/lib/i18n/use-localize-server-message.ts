"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { localizeServerMessage } from "./server-messages";

/**
 * `localizeServerMessage` bound to the language of the surrounding
 * I18nProvider, for components that render a server message directly.
 */
export function useLocalizeServerMessage(): (message: string | null | undefined) => string {
  const { locale } = useI18n();
  return (message) => localizeServerMessage(message, locale);
}
