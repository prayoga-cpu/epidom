"use client";

import { Globe, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/lang/i18n-provider";
import { LANGUAGE_OPTIONS } from "@/components/lang/lang-switcher";
import { ZoomControl } from "@/features/dashboard/shared/zoom-control";
import { cn } from "@/lib/utils";

/**
 * Language, light/dark and zoom, for the POS Mode More menu — the same device
 * preferences Back Office keeps in its Topbar and account dropdown (LangSwitcher,
 * ThemeToggle, ZoomControl), which POS Mode's shell deliberately doesn't mount.
 * All are per-device, not per-persona, so every role sees them.
 *
 * Not a reuse of those two components: both are styled for the dark navy
 * Topbar (hardcoded cream-on-navy colours) and LangSwitcher opens an absolute
 * dropdown that this menu's scroll container would clip. A three-way toggle is
 * also one tap instead of open-then-pick, which is what a till wants.
 */
export function PosModePreferences() {
  const { t, locale, setLocale } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const ThemeIcon = isDark ? Moon : Sun;

  return (
    <div className="space-y-1 rounded-xl border p-3">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Globe className="size-5 shrink-0" aria-hidden />
          <span className="truncate text-sm font-medium">{t("common.language.label")}</span>
        </div>
        <div
          role="group"
          aria-label={t("common.language.label")}
          className="bg-muted flex shrink-0 gap-0.5 rounded-lg p-0.5"
        >
          {LANGUAGE_OPTIONS.map((option) => {
            const active = option.value === locale;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                // The code alone ("ID") is ambiguous to a screen reader.
                aria-label={option.label}
                onClick={() => setLocale(option.value)}
                className={cn(
                  "h-10 min-w-11 rounded-md px-2 text-xs font-semibold tracking-wide transition active:scale-[0.97]",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.short}
              </button>
            );
          })}
        </div>
      </div>

      {/* A <label>, not just a row beside the Switch: the Switch alone is only
          ~18px tall, so the whole 44px row is what makes this tappable. */}
      <label
        htmlFor="pos-dark-mode"
        className="flex min-h-11 cursor-pointer items-center justify-between gap-3"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ThemeIcon className="size-5 shrink-0" aria-hidden />
          <span className="truncate text-sm font-medium">{t("common.theme.dark")}</span>
        </span>
        <Switch
          id="pos-dark-mode"
          checked={isDark}
          onCheckedChange={(on) => setTheme(on ? "dark" : "light")}
        />
      </label>

      {/* Zoom is the third per-device preference, and the one a till needs most —
          a counter screen is exactly where the browser's own zoom is out of reach
          (locked viewport, installed PWA). The shell's More menu is the only
          route to it in POS Mode, which has no topbar or account dropdown. */}
      <ZoomControl label="inline" />
    </div>
  );
}
