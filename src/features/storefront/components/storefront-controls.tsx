"use client";

import React from "react";
import { useTheme } from "next-themes";
import { Globe, Moon, Sun } from "lucide-react";
import { useI18n, type Locale } from "@/components/lang/i18n-provider";

/**
 * Compact, theme-aware control cluster for the public storefront.
 * Lets a customer switch language (ID / EN / FR) and toggle light/dark mode.
 * Renders against semantic tokens so it works on any storefront surface.
 */

const LANGS: { value: Locale; short: string }[] = [
  { value: "id", short: "ID" },
  { value: "en", short: "EN" },
  { value: "fr", short: "FR" },
];

export function StorefrontControls({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";
  // `locale` matches between SSR and the first client render (provider's initial
  // state), so it is hydration-safe to read directly here.
  const activeLang = locale;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Language switcher — segmented pill */}
      <div
        role="group"
        aria-label={t("common.language.label")}
        className="border-border bg-muted/60 flex items-center rounded-full border p-0.5"
      >
        <Globe className="text-muted-foreground mx-1 size-3.5" aria-hidden="true" />
        {LANGS.map((l) => {
          const active = activeLang === l.value;
          return (
            <button
              key={l.value}
              type="button"
              onClick={() => setLocale(l.value)}
              aria-pressed={active}
              className={`rounded-full px-2 py-1 text-[11px] leading-none font-bold transition-colors ${
                active
                  ? "bg-[var(--store-theme)] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l.short}
            </button>
          );
        })}
      </div>

      {/* Theme toggle — theme-dependent attrs are gated on `mounted` because
          next-themes resolves the theme on the client's first render but not on
          the server, which would otherwise mismatch the `title` during hydration. */}
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={t("common.theme.toggle")}
        title={mounted ? (isDark ? t("common.theme.light") : t("common.theme.dark")) : undefined}
        className="border-border bg-muted/60 text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-full border transition-colors"
      >
        {mounted && isDark ? (
          <Sun className="size-4" aria-hidden="true" />
        ) : (
          <Moon className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
