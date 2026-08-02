"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/lang/i18n-provider";
import type { MergedOptionGroup } from "@/lib/utils/menu-item-options";

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
 */
export function MenuItemOptionsDialog({
  open,
  onOpenChange,
  itemName,
  groups,
  initialSelected,
  initialNotes,
  formatPrice,
  onConfirm,
}: MenuItemOptionsDialogProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Record<string, SelectedOptionValue[]>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, SelectedOptionValue[]> = {};
    for (const group of groups) {
      initial[group.name] = (initialSelected ?? []).filter((s) => s.groupName === group.name);
    }
    setSelected(initial);
    setNotes(initialNotes ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemName]);

  const toggleOption = (group: MergedOptionGroup, option: MergedOptionGroup["options"][number]) => {
    const current = selected[group.name] ?? [];
    const isSelected = current.some((o) => o.optionName === option.name);
    let next: SelectedOptionValue[];

    if (group.maxSelections === 1) {
      next = isSelected ? [] : [toSelectedOption(group, option)];
    } else if (isSelected) {
      next = current.filter((o) => o.optionName !== option.name);
    } else if (current.length < group.maxSelections) {
      next = [...current, toSelectedOption(group, option)];
    } else {
      next = [...current.slice(1), toSelectedOption(group, option)];
    }

    setSelected({ ...selected, [group.name]: next });
    setError(null);
  };

  const handleConfirm = () => {
    for (const group of groups) {
      if (group.isRequired && (selected[group.name]?.length ?? 0) === 0) {
        setError(`${t("publicOrder.itemDetail.selectOptionAlert")} "${group.name}"`);
        return;
      }
    }
    const selectedOptions = Object.values(selected).flat();
    onConfirm({ selectedOptions, notes: notes.trim() || "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={itemName}
        description={t("pos.options.dialogDesc")}
        maxWidth="md"
        footer={
          <>
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
          {groups.map((group) => (
            <div key={group.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {group.name}
                  {group.isRequired && <span className="text-destructive ml-1">*</span>}
                </h4>
                <span className="text-muted-foreground bg-muted rounded px-2 py-0.5 text-[10px] font-medium">
                  {group.isRequired
                    ? t("publicOrder.itemDetail.required")
                    : t("publicOrder.itemDetail.optional")}
                </span>
              </div>
              <div className="grid gap-2">
                {group.options.map((option) => {
                  const isSelected = (selected[group.name] ?? []).some(
                    (o) => o.optionName === option.name
                  );
                  return (
                    <button
                      type="button"
                      key={option.name}
                      onClick={() => toggleOption(group, option)}
                      className={`flex items-center justify-between rounded-lg border p-3 text-left transition ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-5 items-center justify-center rounded-md border transition-colors ${
                            isSelected
                              ? "border-transparent bg-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isSelected && (
                            <Check className="text-primary-foreground size-3.5 stroke-[3px]" />
                          )}
                        </div>
                        <span className="text-sm font-medium">{option.name}</span>
                      </div>
                      <span className="text-muted-foreground text-xs font-semibold">
                        {option.priceAdjustment !== 0
                          ? `+${formatPrice(option.priceAdjustment)}`
                          : t("publicOrder.itemDetail.free")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {error && <p className="text-destructive text-sm">{error}</p>}

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
