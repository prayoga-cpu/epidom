"use client";

import { Check, Globe } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { LANGUAGE_OPTIONS } from "@/components/lang/language-options";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/features/dashboard/shared/theme-toggle";

/**
 * The admin nav's language and light / dark controls, drawn with the nav's own
 * palette (theme tokens, text-xs, 40px targets) so they sit in it in either
 * theme. The shared LangSwitcher is cream-on-navy and would vanish on a light bar.
 */
export function AdminPreferences() {
  const { t, locale, setLocale } = useI18n();
  const current = LANGUAGE_OPTIONS.find((o) => o.value === locale) ?? LANGUAGE_OPTIONS[0];

  return (
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground h-10 cursor-pointer gap-1.5 px-3 text-xs font-semibold"
            aria-label={`${t("adminNav.language")}: ${current.label}`}
          >
            <Globe className="h-3.5 w-3.5" aria-hidden />
            {current.short}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {LANGUAGE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setLocale(option.value)}
              className="flex items-center gap-2 text-xs"
            >
              <span aria-hidden>{option.flag}</span>
              <span className="font-semibold">{option.short}</span>
              <span className="text-muted-foreground">{option.label}</span>
              {option.value === locale && <Check className="ml-auto h-3.5 w-3.5" aria-hidden />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ThemeToggle tone="surface" />
    </div>
  );
}
