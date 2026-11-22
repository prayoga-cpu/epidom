"use client";

import * as provider from "./i18n-provider";

type I18n = ReturnType<typeof provider.useI18n>;

/**
 * `useI18n()` for components that may render with no I18nProvider above them:
 * the shared `ui/` primitives (a dialog's "Close", a sheet's title) and the
 * error screens. Returns null there, so the caller shows its built-in English
 * (or its own fallback) instead of throwing inside an error handler.
 *
 * It lives in its own module, and reads the provider through the namespace,
 * because a great many tests mock "@/components/lang/i18n-provider" with only
 * `useI18n`. A named import of anything else from that module would make every
 * one of those tests fail on a missing export; here a mocked provider simply
 * falls through to its `useI18n`, so the mock's `t` is what the primitive gets.
 */
export function useOptionalI18n(): I18n | null {
  let readContext: (() => I18n | null) | undefined;
  try {
    readContext = provider.useI18nContextOrNull;
  } catch {
    readContext = undefined; // a mock without this export throws on access
  }
  // The branch is fixed for the lifetime of a module graph (real vs mocked
  // provider), so the same hook runs on every render of a component.
  if (typeof readContext === "function") return readContext();
  try {
    return provider.useI18n();
  } catch {
    return null;
  }
}
