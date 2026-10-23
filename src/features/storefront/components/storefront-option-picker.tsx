"use client";

import type { MutableRefObject } from "react";
import { Check } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";

export interface StorefrontModifierOption {
  name: string;
  priceAdd: number;
}

export interface StorefrontModifierGroup {
  name: string;
  isRequired?: boolean;
  maxSelections?: number;
  options: StorefrontModifierOption[];
}

interface StorefrontOptionPickerProps {
  groups: StorefrontModifierGroup[];
  selected: Record<string, StorefrontModifierOption[]>;
  onToggle: (group: StorefrontModifierGroup, option: StorefrontModifierOption) => void;
  /** Build Your Own: numbered steps with a progress bar (isBuildYourOwnItem). */
  buildYourOwn: boolean;
  /** The required group the customer skipped, highlighted until they pick. */
  missingGroup: string | null;
  formatPrice: (amount: number) => string;
  /** Lets the parent scroll a skipped step into view. */
  groupRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  /** "page" sits the choices on a muted page (item page), "drawer" on a card. */
  surface: "drawer" | "page";
}

/**
 * The customer's option picker on the public storefront: the menu's item
 * drawer and the item page. Themed with the store's colour (--store-theme).
 */
export function StorefrontOptionPicker({
  groups,
  selected,
  onToggle,
  buildYourOwn,
  missingGroup,
  formatPrice,
  groupRefs,
  surface,
}: StorefrontOptionPickerProps) {
  const { t } = useI18n();
  const doneCount = groups.filter((g) => (selected[g.name]?.length ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      {buildYourOwn && groups.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-foreground text-xs font-extrabold tracking-wider uppercase">
              {t("publicOrder.itemDetail.byoTitle")}
            </p>
            <p className="text-muted-foreground text-[11px] font-semibold">
              {t("publicOrder.itemDetail.byoProgress")
                .replace("{done}", String(doneCount))
                .replace("{total}", String(groups.length))}
            </p>
          </div>
          <div className="flex gap-1">
            {groups.map((g) => (
              <span
                key={g.name}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  (selected[g.name]?.length ?? 0) > 0 ? "bg-[var(--store-theme)]" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      )}

      {groups.map((group, groupIndex) => {
        const picks = selected[group.name] ?? [];
        const max = Math.max(1, group.maxSelections || 1);
        const isFull = buildYourOwn && max > 1 && picks.length >= max;
        const isDone = picks.length > 0;
        const isMissing = missingGroup === group.name;
        return (
          <section
            key={group.name}
            ref={(el) => {
              groupRefs.current[group.name] = el;
            }}
            className={cn("space-y-2 rounded-xl", isMissing && "ring-destructive p-2 ring-2")}
          >
            <div className="flex items-center gap-2">
              {buildYourOwn && (
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black",
                    isDone ? "bg-[var(--store-theme)] text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {isDone ? <Check className="size-3.5 stroke-[3px]" /> : groupIndex + 1}
                </span>
              )}
              <h4 className="text-foreground min-w-0 flex-1 text-sm font-bold">
                {group.name}
                {group.isRequired && <span className="text-destructive ml-1 font-black">*</span>}
              </h4>
              <span className="text-muted-foreground bg-muted shrink-0 rounded px-2 py-0.5 text-[10px] font-bold">
                {group.isRequired
                  ? t("publicOrder.itemDetail.required")
                  : t("publicOrder.itemDetail.optional")}
              </span>
            </div>
            {buildYourOwn && (
              <p className="text-muted-foreground text-[11px]">
                {max === 1
                  ? t("publicOrder.itemDetail.chooseOne")
                  : t("publicOrder.itemDetail.chooseUpTo")
                      .replace("{n}", String(max))
                      .replace("{count}", String(picks.length))}
              </p>
            )}

            <div className="grid gap-2">
              {group.options.map((option) => {
                const isSelected = picks.some((o) => o.name === option.name);
                const isBlocked = isFull && !isSelected;
                return (
                  <button
                    type="button"
                    key={option.name}
                    onClick={() => onToggle(group, option)}
                    disabled={isBlocked}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border p-3 text-left transition",
                      isSelected
                        ? "border-[var(--store-theme)] bg-[var(--store-theme-light-bg)]"
                        : cn(
                            "border-border hover:border-muted-foreground/30",
                            surface === "page" && "bg-card"
                          ),
                      isBlocked && "opacity-50"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                          isSelected
                            ? "border-transparent bg-[var(--store-theme)]"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {isSelected && <Check className="size-3.5 stroke-[3px] text-white" />}
                      </span>
                      <span className="text-foreground text-xs font-semibold">{option.name}</span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs font-bold">
                      {option.priceAdd > 0
                        ? `+${formatPrice(option.priceAdd)}`
                        : t("publicOrder.itemDetail.free")}
                    </span>
                  </button>
                );
              })}
            </div>
            {isMissing && (
              <p className="text-destructive text-xs font-semibold">
                {`${t("publicOrder.itemDetail.selectOptionAlert")} "${group.name}"`}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
