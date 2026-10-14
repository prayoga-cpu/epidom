"use client";

import type React from "react";
import { I18nProvider } from "./i18n-provider";

// English needs no seeding: it is the registry's static baseline
// (src/locales/index.ts).

export function EnglishSeededI18nProvider({
  children,
  followVisitorPreference = false,
}: {
  children: React.ReactNode;
  followVisitorPreference?: boolean;
}) {
  return followVisitorPreference ? (
    <I18nProvider defaultLocale="en">{children}</I18nProvider>
  ) : (
    <I18nProvider initialLocale="en">{children}</I18nProvider>
  );
}
