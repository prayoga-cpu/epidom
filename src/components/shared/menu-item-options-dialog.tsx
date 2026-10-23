"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import {
  firstMissingRequiredGroup,
  toggleOptionSelection,
  type MergedOptionGroup,
} from "@/lib/utils/menu-item-options";

export interface SelectedOptionValue {
  groupName: string;
  optionName: string;
  priceAdjustment: number;
  materialId?: string;
  materialQty?: number;
}

interface MenuItemOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  groups: MergedOptionGroup[];
  basePrice?: number;
  /** Build Your Own: the groups are numbered steps (MenuItem/Product.buildYourOwn). */
  buildYourOwn?: boolean;
  initialSelected?: SelectedOptionValue[];
  initialNotes?: string;
  formatPrice: (amount: number) => string;
  onConfirm: (result: { selectedOptions: SelectedOptionValue[]; notes: string }) => void;
}

/**
 * Configure-before-adding picker for a menu item's option groups — shared by
 * POS Cashier and both storefront surfaces so the selection/validation logic
 * (radio for maxSelections===1, checkboxes otherwise, required-group
 * enforcement) lives in exactly one place.
 *
 * With `buildYourOwn` the groups read as numbered steps: each shows its pick
 * limit, ticks off once chosen, and a full step refuses an extra pick rather
 * than dropping an earlier one.
 */
export function MenuItemOptionsDialog({
  open,
  onOpenChange,
  itemName,
  groups,
  basePrice = 0,
  buildYourOwn = false,
  initialSelected,
  initialNotes,
  formatPrice,
  onConfirm,
}: MenuItemOptionsDialogProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Record<string, SelectedOptionValue[]>>({});
  const [notes, setNotes] = useState("");
  const [missingGroup, setMissingGroup] = useState<string | null>(null);
  const groupRefs = useRef<Record<string, HTMLElement | null>>({});

  const addonsTotal = Object.values(selected)
    .flat()
    .reduce((sum, o) => sum + o.priceAdjustment, 0);
  const runningTotal = basePrice + addonsTotal;

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, SelectedOptionValue[]> = {};
    for (const group of groups) {
      initial[group.name] = (initialSelected ?? []).filter((s) => s.groupName === group.name);
    }
    setSelected(initial);
    setNotes(initialNotes ?? "");
    setMissingGroup(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemName]);

  const toggleOption = (group: MergedOptionGroup, option: MergedOptionGroup["options"][number]) => {
    const next = toggleOptionSelection(
      selected[group.name] ?? [],
      toSelectedOption(group, option),
      (a, b) => a.optionName === b.optionName,
      group.maxSelections,
      { capAtMax: buildYourOwn }
    );
    setSelected({ ...selected, [group.name]: next });
    if (missingGroup === group.name) setMissingGroup(null);
  };

  const handleConfirm = () => {
    const missing = firstMissingRequiredGroup(groups, selected);
    if (missing) {
      setMissingGroup(missing);
      groupRefs.current[missing]?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const selectedOptions = Object.values(selected).flat();
    onConfirm({ selectedOptions, notes: notes.trim() || "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={itemName}
        description={t(buildYourOwn ? "pos.options.byoDialogDesc" : "pos.options.dialogDesc")}
        maxWidth={buildYourOwn ? "lg" : "md"}
        footer={
          <>
            <div className="text-muted-foreground mr-auto flex items-baseline gap-1 text-xs">
              <span>{t("pos.options.total")}</span>
              <span className="text-foreground text-sm font-semibold tabular-nums">
                {formatPrice(runningTotal)}
              </span>
            </div>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="button" onClick={handleConfirm}>
              {t("pos.options.addToCart")}
            </Button>
          </>
        }
      >
        <div className="space-y-5 py-2">
          {buildYourOwn && (
            <p className="text-muted-foreground text-sm">{t("pos.options.byoHint")}</p>
          )}
          {groups.map((group, groupIndex) => {
            const picks = selected[group.name] ?? [];
            const max = Math.max(1, group.maxSelections);
            const isFull = buildYourOwn && max > 1 && picks.length >= max;
            const isDone = picks.length > 0;
            const isMissing = missingGroup === group.name;
            return (
              <section
                key={group.name}
                ref={(el) => {
                  groupRefs.current[group.name] = el;
                }}
                className={cn("space-y-2 rounded-lg", isMissing && "ring-destructive p-2 ring-2")}
              >
                <div className="flex items-center gap-2">
                  {buildYourOwn && (
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        isDone
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isDone ? <Check className="size-3.5 stroke-[3px]" /> : groupIndex + 1}
                    </span>
                  )}
                  <h4 className="min-w-0 flex-1 text-sm font-semibold">
                    {group.name}
                    {group.isRequired && <span className="text-destructive ml-1">*</span>}
                  </h4>
                  <span className="text-muted-foreground bg-muted shrink-0 rounded px-2 py-0.5 text-[10px] font-medium">
                    {group.isRequired
                      ? t("publicOrder.itemDetail.required")
                      : t("publicOrder.itemDetail.optional")}
                  </span>
                </div>
                {buildYourOwn && (
                  <p className="text-muted-foreground text-xs">
                    {max === 1
                      ? t("pos.options.pickOne")
                      : t("pos.options.pickUpTo")
                          .replace("{n}", String(max))
                          .replace("{count}", String(picks.length))}
                  </p>
                )}
                <div className={cn("grid gap-2", buildYourOwn && "sm:grid-cols-2")}>
                  {group.options.map((option) => {
                    const isSelected = picks.some((o) => o.optionName === option.name);
                    const isBlocked = isFull && !isSelected;
                    return (
                      <button
                        type="button"
                        key={option.name}
                        onClick={() => toggleOption(group, option)}
                        disabled={isBlocked}
                        className={cn(
                          "flex min-h-11 items-center justify-between gap-2 rounded-lg border p-3 text-left transition",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/30",
                          isBlocked && "opacity-50"
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                              isSelected
                                ? "bg-primary border-transparent"
                                : "border-muted-foreground/30"
                            )}
                          >
                            {isSelected && (
                              <Check className="text-primary-foreground size-3.5 stroke-[3px]" />
                            )}
                          </div>
                          <span className="text-sm font-medium">{option.name}</span>
                        </div>
                        <span className="text-muted-foreground shrink-0 text-xs font-semibold">
                          {option.priceAdjustment !== 0
                            ? `+${formatPrice(option.priceAdjustment)}`
                            : t("publicOrder.itemDetail.free")}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {isMissing && (
                  <p className="text-destructive text-xs">
                    {`${t("publicOrder.itemDetail.selectOptionAlert")} "${group.name}"`}
                  </p>
                )}
              </section>
            );
          })}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("pos.checkout.notes")}</label>
            <Textarea
              placeholder={t("pos.options.notesPlaceholder")}
              className="resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </FormDialogLayout>
    </Dialog>
  );
}

function toSelectedOption(
  group: MergedOptionGroup,
  option: MergedOptionGroup["options"][number]
): SelectedOptionValue {
  return {
    groupName: group.name,
    optionName: option.name,
    priceAdjustment: option.priceAdjustment,
    materialId: option.materialId,
    materialQty: option.materialQty,
  };
}
