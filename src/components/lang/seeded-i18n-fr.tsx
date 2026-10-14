"use client";

import type React from "react";
import { fr } from "@/locales/fr";
import { seedLocale, type Lang } from "@/locales";
import { I18nProvider } from "./i18n-provider";

// Seeded at module scope so the dictionary is resident before the first
// render, on the server too (see seeded-i18n-provider.tsx for why each
// language has its own module).
seedLocale("fr" as Lang, fr);

export function FrenchSeededI18nProvider({
  children,
  followVisitorPreference = false,
}: {
  children: React.ReactNode;
  followVisitorPreference?: boolean;
}) {
  return followVisitorPreference ? (
    <I18nProvider defaultLocale="fr">{children}</I18nProvider>
  ) : (
    <I18nProvider initialLocale="fr">{children}</I18nProvider>
  );
}
