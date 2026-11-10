"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import LangSwitcher from "@/components/lang/lang-switcher";
import { ThemeToggle } from "@/features/dashboard/shared/theme-toggle";
import { EpidomLockup } from "@/features/marketing/shared/components/epidom-logo";
import { cn } from "@/lib/utils";

/**
 * The "your store is live" screen's page chrome: full-bleed on phones with a
 * sticky action bar at the bottom, a centred card (max-w-2xl) from `sm` up.
 * The setup questions use FlowFrame instead.
 */
/**
 * A brand-new account has not chosen a theme yet, and the app's fallback is
 * dark. Setup is the first screen after sign-up, so follow the device's
 * light/dark setting here; a choice already made (the toggle, or an earlier
 * visit) is stored under next-themes' key and left alone. The language needs
 * no such step: with no saved choice, I18nProvider already reads the
 * browser's language.
 */
function useSystemThemeUntilChosen() {
  const { setTheme } = useTheme();
  React.useEffect(() => {
    try {
      if (window.localStorage.getItem("theme")) return;
    } catch {
      return;
    }
    setTheme("system");
  }, [setTheme]);
}

export function WizardFrame({
  children,
  wide = false,
  notice,
}: {
  children: React.ReactNode;
  /** Step 2: room for the phone preview next to the form on large screens. */
  wide?: boolean;
  /** Rendered above the card (e.g. the verification-link notice). */
  notice?: React.ReactNode;
}) {
  useSystemThemeUntilChosen();
  return (
    <div className="bg-background sm:bg-muted/40 flex min-h-[calc(100dvh/var(--app-zoom,1))] flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <div className="text-foreground">
          <EpidomLockup size={26} />
        </div>
        <div className="flex items-center gap-2">
          <LangSwitcher tone="surface" />
          <ThemeToggle tone="surface" />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col sm:items-center sm:px-4 sm:pb-10">
        {notice ? <div className="w-full px-4 pb-3 sm:max-w-2xl sm:px-0">{notice}</div> : null}
        <div
          className={cn(
            "bg-background flex min-h-0 w-full flex-1 flex-col sm:max-w-2xl sm:flex-none sm:rounded-2xl sm:border sm:shadow-sm",
            wide && "lg:max-w-5xl"
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

export const PRIMARY_BUTTON_CLASS =
  "h-11 rounded-xl bg-[var(--epi-gold-500)] px-5 font-semibold text-[var(--epi-navy-900)] hover:bg-[var(--epi-gold-600)]";

/**
 * The setup questions' page chrome: no card, one question centred on the page
 * at a time, a thin progress bar under the header. `progress` runs 0 to 1.
 */
export function FlowFrame({
  children,
  progress,
  notice,
  wide = false,
}: {
  children: React.ReactNode;
  progress: number;
  /** Room for two cards side by side (the plan screen). */
  wide?: boolean;
  /** Rendered above the question (e.g. the verification-link notice). */
  notice?: React.ReactNode;
}) {
  useSystemThemeUntilChosen();
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className="bg-background flex min-h-[calc(100dvh/var(--app-zoom,1))] flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <div className="text-foreground">
          <EpidomLockup size={26} />
        </div>
        <div className="flex items-center gap-2">
          <LangSwitcher tone="surface" />
          <ThemeToggle tone="surface" />
        </div>
      </header>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="bg-muted h-1 w-full shrink-0"
      >
        <div
          className="h-full bg-[var(--epi-gold-500)] transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <main className="flex min-h-0 flex-1 flex-col items-center px-4 sm:px-6">
        <div
          className={cn(
            "flex min-h-0 w-full flex-1 flex-col py-6 sm:py-10",
            wide ? "max-w-4xl" : "max-w-xl"
          )}
        >
          {notice ? <div className="pb-4">{notice}</div> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
