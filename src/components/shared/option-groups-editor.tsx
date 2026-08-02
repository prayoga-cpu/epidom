"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DecimalInput } from "@/components/shared/decimal-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMaterials } from "@/features/dashboard/data/materials/hooks/use-materials";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import type { ProductOptionGroupInput, ProductOptionInput } from "@/lib/validation/inventory.schemas";

const emptyOption: ProductOptionInput = { name: "", priceAdjustment: 0 };
const emptyGroup = (): ProductOptionGroupInput => ({
  name: "",
  isRequired: false,
  maxSelections: 1,
  options: [{ ...emptyOption }],
});

interface OptionGroupsEditorProps {
  storeId: string;
  value: ProductOptionGroupInput[];
  onChange: (groups: ProductOptionGroupInput[]) => void;
  /** Show a Material + quantity picker on each option, for stock-accurate variants. */
  allowMaterialLink?: boolean;
  className?: string;
}

/**
 * Repeatable editor for option/modifier groups — shared by the Product
 * editor (allowMaterialLink: true, links options to Material for accurate
 * stock deduction) and the storefront Menu editor (allowMaterialLink:
 * false, price-only add-ons stored on MenuItem.modifiers).
 */
export function OptionGroupsEditor({
  storeId,
  value,
  onChange,
  allowMaterialLink = false,
  className,
}: OptionGroupsEditorProps) {
  const { t } = useI18n();
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency);
  const { data: materialsData } = useMaterials(storeId);
  const materials = allowMaterialLink ? materialsData?.materials || [] : [];

  const updateGroup = (index: number, patch: Partial<ProductOptionGroupInput>) => {
    const next = value.map((g, i) => (i === index ? { ...g, ...patch } : g));
    onChange(next);
  };

  const removeGroup = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addGroup = () => {
    onChange([...value, emptyGroup()]);
  };

  const updateOption = (groupIndex: number, optionIndex: number, patch: Partial<ProductOptionInput>) => {
    const group = value[groupIndex];
    const options = group.options.map((o, i) => (i === optionIndex ? { ...o, ...patch } : o));
    updateGroup(groupIndex, { options });
  };

  const removeOption = (groupIndex: number, optionIndex: number) => {
    const group = value[groupIndex];
    updateGroup(groupIndex, { options: group.options.filter((_, i) => i !== optionIndex) });
  };

  const addOption = (groupIndex: number) => {
    const group = value[groupIndex];
    updateGroup(groupIndex, { options: [...group.options, { ...emptyOption }] });
  };

  return (
    <div className={className}>
      <div className="space-y-3">
        {value.map((group, groupIndex) => (
          <Card key={groupIndex} className="relative overflow-hidden">
            <CardContent className="space-y-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <Input
                  placeholder={t("data.products.options.groupNamePlaceholder")}
                  value={group.name}
                  onChange={(e) => updateGroup(groupIndex, { name: e.target.value })}
                  className="max-w-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
                  onClick={() => removeGroup(groupIndex)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-normal">
                  <Checkbox
                    checked={group.isRequired}
                    onCheckedChange={(checked) =>
                      updateGroup(groupIndex, { isRequired: checked === true })
                    }
                  />
                  {t("data.products.options.required")}
                </label>
                <label className="text-muted-foreground flex items-center gap-2 text-sm">
                  {t("data.products.options.maxSelections")}
                  <Input
                    type="number"
                    min={1}
                    value={group.maxSelections}
                    onChange={(e) =>
                      updateGroup(groupIndex, {
                        maxSelections: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                    className="h-8 w-16"
                  />
                </label>
              </div>

              <div className="space-y-2">
                {group.options.map((option, optionIndex) => {
                  const selectedMaterial = materials.find((m) => m.id === option.materialId);
                  return (
                    <div
                      key={optionIndex}
                      className="bg-muted/30 flex flex-col gap-2 rounded-md border p-2 sm:flex-row sm:items-end"
                    >
                      <div className="flex min-w-0 flex-col gap-1 sm:max-w-[160px]">
                        <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                          {t("data.products.options.optionNameLabel")}
                        </span>
                        <Input
                          placeholder={t("data.products.options.optionNamePlaceholder")}
                          value={option.name}
                          onChange={(e) =>
                            updateOption(groupIndex, optionIndex, { name: e.target.value })
                          }
                        />
                      </div>

                      <div className="flex min-w-0 flex-col gap-1 sm:w-36">
                        <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                          {t("data.products.options.priceAddOnLabel")}
                        </span>
                        <div className="relative">
                          <span className="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2 text-xs">
                            +{currencySymbol}
                          </span>
                          <DecimalInput
                            decimals={2}
                            placeholder="0.00"
                            className="pl-8"
                            value={option.priceAdjustment}
                            onChange={(v) =>
                              updateOption(groupIndex, optionIndex, { priceAdjustment: v ?? 0 })
                            }
                          />
                        </div>
                      </div>

                      {allowMaterialLink && (
                        <>
                          {/* min-w-0 on the wrapper lets the flex item actually shrink to
                              sm:w-44 instead of growing to fit content; w-full on the
                              trigger overrides its w-fit default so a long material name
                              truncates (line-clamp-1, baked into SelectTrigger) instead of
                              blowing out the row. */}
                          <div className="flex min-w-0 flex-col gap-1 sm:w-44">
                            <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                              {t("data.products.options.linkMaterialLabel")}
                            </span>
                            <Select
                              value={option.materialId || "none"}
                              onValueChange={(v) =>
                                updateOption(groupIndex, optionIndex, {
                                  materialId: v === "none" ? undefined : v,
                                  materialQty: v === "none" ? undefined : option.materialQty,
                                })
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder={t("data.products.options.linkMaterial")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  {t("data.products.options.noMaterial")}
                                </SelectItem>
                                {[...materials]
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map((material) => (
                                    <SelectItem key={material.id} value={material.id}>
                                      {material.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {option.materialId && (
                            <div className="flex min-w-0 flex-col gap-1 sm:w-32">
                              <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                                {t("data.products.options.stockReductionLabel")}
                              </span>
                              <div className="relative">
                                <DecimalInput
                                  decimals={3}
                                  min={0}
                                  placeholder="0"
                                  className="pr-12"
                                  value={option.materialQty}
                                  onChange={(v) =>
                                    updateOption(groupIndex, optionIndex, { materialQty: v })
                                  }
                                />
                                {selectedMaterial && (
                                  <span className="text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2 text-xs">
                                    {selectedMaterial.unit}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive h-9 w-9 shrink-0 sm:ml-auto"
                        onClick={() => removeOption(groupIndex, optionIndex)}
                        disabled={group.options.length === 1}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addOption(groupIndex)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t("data.products.options.addOption")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addGroup}>
        <Plus className="mr-1 h-4 w-4" />
        {t("data.products.options.addGroup")}
      </Button>
    </div>
  );
}
