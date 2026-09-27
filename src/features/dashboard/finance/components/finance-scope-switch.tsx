"use client";

import { Building2, Store } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";

export type FinanceScope = "store" | "all";

interface FinanceScopeSwitchProps {
  scope: FinanceScope;
  onChange: (scope: FinanceScope) => void;
}

/**
 * "This outlet / All outlets" — the one control that replaced the standalone
 * Owner dashboard. Two real buttons rather than Tabs: each option swaps the
 * whole report underneath (different queries, different filters), which is a
 * page-level choice, not a panel inside one report.
 *
 * Each button is h-10 (the 40px touch minimum — the group's padding ring is
 * not tappable). On a phone the group takes the full row and each option
 * shares it, truncating its label: the French "Tous les établissements" alone
 * would otherwise push the switch past a 375px screen.
 */
export function FinanceScopeSwitch({ scope, onChange }: FinanceScopeSwitchProps) {
  const { t } = useI18n();
  const options: Array<{ value: FinanceScope; label: string; Icon: typeof Store }> = [
    { value: "store", label: t("pages.financeScopeThisOutlet"), Icon: Store },
    { value: "all", label: t("pages.financeScopeAllOutlets"), Icon: Building2 },
  ];

  return (
    <div
      role="group"
      aria-label={t("pages.financeScopeLabel")}
      className="bg-muted flex w-full min-w-0 items-center rounded-lg p-0.5 sm:inline-flex sm:w-auto"
    >
      {options.map(({ value, label, Icon }) => {
        const active = scope === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            title={label}
            onClick={() => {
              if (!active) onChange(value);
            }}
            className={cn(
              "inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors sm:flex-none",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
