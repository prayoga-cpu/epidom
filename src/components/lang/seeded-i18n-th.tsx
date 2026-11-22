"use client";

import type React from "react";
import { th } from "@/locales/th";
import { seedLocale, type Lang } from "@/locales";
import { I18nProvider } from "./i18n-provider";

// Seeded at module scope so the dictionary is resident before the first
// render, on the server too (see seeded-i18n-provider.tsx for why each
// language has its own module).
seedLocale("th" as Lang, th);

export function ThaiSeededI18nProvider({
  children,
  followVisitorPreference = false,
}: {
  children: React.ReactNode;
  followVisitorPreference?: boolean;
}) {
  return followVisitorPreference ? (
    <I18nProvider defaultLocale="th">{children}</I18nProvider>
  ) : (
    <I18nProvider initialLocale="th">{children}</I18nProvider>
  );
}
