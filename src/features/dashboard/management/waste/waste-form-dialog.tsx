"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { WasteReason } from "@prisma/client";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/shared/decimal-input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { useMaterials } from "@/features/dashboard/data/materials/hooks/use-materials";
import { useProducts } from "@/features/dashboard/data/products/hooks/use-products";
import {
  useRecordWaste,
  useUpdateWasteEntry,
  type WasteEntryWithRelations,
} from "./hooks/use-waste";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";

const WASTE_REASONS = Object.values(WasteReason);

const formSchema = z
  .object({
    itemType: z.enum(["material", "product"]),
    itemId: z.string().min(1, "Please select an item"),
    quantity: z.coerce.number().positive("Quantity must be positive"),
    reason: z.nativeEnum(WasteReason),
    customReason: z.string().max(200).optional(),
    notes: z.string().max(500).optional(),
    referenceId: z.string().max(100).optional(),
    unitCostOverride: z.coerce.number().positive().optional(),
  })
  .refine((data) => data.reason !== WasteReason.OTHER || !!data.customReason?.trim(), {
    message: "Please describe the reason",
    path: ["customReason"],
  });

type FormData = z.infer<typeof formSchema>;

interface WasteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  mode: "create" | "edit";
  wasteEntry?: WasteEntryWithRelations | null;
  /** Preselect an item when opened from that item's own row (create mode). */
  itemId?: string;
  itemType?: "material" | "product";
}

export function WasteFormDialog({
  open,
  onOpenChange,
  storeId,
  mode,
  wasteEntry,
  itemId,
  itemType = "material",
}: WasteFormDialogProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: materialsData } = useMaterials(storeId);
  const { data: productsData } = useProducts(storeId, {});
  const materials = materialsData?.materials ?? [];
  const products = productsData?.products ?? [];

  const recordWaste = useRecordWaste(storeId);
  const updateWaste = useUpdateWasteEntry(storeId);
  const isSubmitting = recordWaste.isPending || updateWaste.isPending;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemType,
      itemId: itemId || "",
      quantity: 0,
      reason: WasteReason.EXPIRED,
      customReason: "",
      notes: "",
      referenceId: "",
      unitCostOverride: undefined,
    },
  });

  useEffect(() => {
    if (!open) return;
    setShowAdvanced(false);
    if (mode === "edit" && wasteEntry) {
      form.reset({
        itemType: wasteEntry.materialId ? "material" : "product",
        itemId: (wasteEntry.materialId || wasteEntry.productId) ?? "",
        quantity: wasteEntry.quantity,
        reason: wasteEntry.reason,
        customReason: wasteEntry.customReason ?? "",
        notes: wasteEntry.notes ?? "",
        referenceId: wasteEntry.referenceId ?? "",
        unitCostOverride: undefined,
      });
    } else {
      form.reset({
        itemType,
        itemId: itemId || "",
        quantity: 0,
        reason: WasteReason.EXPIRED,
        customReason: "",
        notes: "",
        referenceId: "",
        unitCostOverride: undefined,
      });
    }
  }, [open, mode, wasteEntry, itemId, itemType, form]);

  const watchItemType = form.watch("itemType");
  const watchItemId = form.watch("itemId");
  const watchReason = form.watch("reason");
  const watchQuantity = form.watch("quantity");
  const watchUnitCostOverride = form.watch("unitCostOverride");

  const availableItems = watchItemType === "material" ? materials : products;
  const selectedItem = useMemo(
    () => availableItems.find((item) => item.id === watchItemId),
    [availableItems, watchItemId]
  );

  const liveUnitCost =
    mode === "edit"
      ? (watchUnitCostOverride ?? Number(wasteEntry?.unitCostSnapshot ?? 0))
      : selectedItem
        ? Number(
            watchItemType === "material"
              ? (selectedItem as (typeof materials)[number]).unitCost
              : (selectedItem as (typeof products)[number]).costPrice
          )
        : 0;

  const estimatedLoss = round2((Number(watchQuantity) || 0) * liveUnitCost);

  const onSubmit = async (data: FormData) => {
    try {
      if (mode === "create") {
        await recordWaste.mutateAsync({
          materialId: data.itemType === "material" ? data.itemId : undefined,
          productId: data.itemType === "product" ? data.itemId : undefined,
          quantity: data.quantity,
          reason: data.reason,
          customReason: data.reason === WasteReason.OTHER ? data.customReason : undefined,
          notes: data.notes || undefined,
          referenceId: data.referenceId || undefined,
        });
        toast.success(t("waste.toasts.recorded.title") || "Waste recorded");
      } else if (wasteEntry) {
        await updateWaste.mutateAsync({
          wasteId: wasteEntry.id,
          input: {
            quantity: data.quantity,
            reason: data.reason,
            customReason: data.reason === WasteReason.OTHER ? data.customReason : undefined,
            notes: data.notes || undefined,
            referenceId: data.referenceId || undefined,
            unitCostOverride: data.unitCostOverride,
          },
        });
        toast.success(t("waste.toasts.updated.title") || "Waste entry updated");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        mode === "create"
          ? t("waste.toasts.recordError.title") || "Failed to record waste"
          : t("waste.toasts.updateError.title") || "Failed to update waste entry",
        { description: error instanceof Error ? error.message : undefined }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={
          mode === "create"
            ? t("waste.dialog.createTitle") || "Record Waste"
            : t("waste.dialog.editTitle") || "Correct Waste Entry"
        }
        description={
          mode === "create"
            ? t("waste.dialog.createDescription") ||
              "Record a wasted product or raw material and its reason."
            : t("waste.dialog.editDescription") ||
              "Correct this entry — quantity/cost changes adjust current stock accordingly."
        }
        maxWidth="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" form="waste-form" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-1 hidden h-4 w-4 animate-spin sm:inline" />}
              {mode === "create"
                ? t("waste.actions.record") || "Record Waste"
                : t("waste.actions.save") || "Save Correction"}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form id="waste-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {mode === "create" && (
              <>
                <FormField
                  control={form.control}
                  name="itemType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("waste.fields.itemType") || "Item type"}</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("itemId", "");
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="material">
                            {t("management.editStock.material") || "Material"}
                          </SelectItem>
                          <SelectItem value="product">
                            {t("management.editStock.product") || "Product"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="itemId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {watchItemType === "material"
                          ? t("waste.fields.selectMaterial") || "Material"
                          : t("waste.fields.selectProduct") || "Product"}{" "}
                        *
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t("waste.fields.selectMaterial") || "Select an item"}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[...availableItems]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}{" "}
                                <span className="text-muted-foreground text-xs">
                                  ({t("management.editStock.current")}: {String(item.currentStock)}{" "}
                                  {item.unit})
                                </span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {mode === "edit" && wasteEntry && (
              <div className="bg-muted/50 rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">
                  {wasteEntry.material?.name ?? wasteEntry.product?.name ?? "—"}
                </span>
              </div>
            )}

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("waste.fields.quantity") || "Quantity"}{" "}
                    {selectedItem && `(${selectedItem.unit})`} *
                  </FormLabel>
                  <FormControl>
                    <DecimalInput
                      decimals={3}
                      min={0}
                      placeholder="0.000"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("waste.fields.reason") || "Reason"} *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WASTE_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {t(`waste.reasons.${reasonKey(reason)}`) || reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchReason === WasteReason.OTHER && (
              <FormField
                control={form.control}
                name="customReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("waste.fields.customReason") || "Describe the reason"} *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("waste.fields.customReasonPlaceholder") || "e.g. Power outage"}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("waste.fields.notes") || "Notes"}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("waste.fields.notesPlaceholder") || "Optional details"}
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {estimatedLoss > 0 && (
              <p className="text-muted-foreground text-sm">
                {(t("waste.fields.estimatedLoss") || "Estimated loss") + ": "}
                <span className="text-foreground font-semibold">{formatPrice(estimatedLoss)}</span>
              </p>
            )}

            {mode === "edit" && (
              <div className="space-y-3 border-t pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  {showAdvanced ? (
                    <ChevronUp className="mr-1 h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="mr-1 h-3.5 w-3.5" />
                  )}
                  {t("waste.fields.advancedOverride") || "Advanced: override unit cost"}
                </Button>
                {showAdvanced && (
                  <FormField
                    control={form.control}
                    name="unitCostOverride"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("waste.fields.unitCostOverride") || "Unit cost override"}</FormLabel>
                        <FormControl>
                          <DecimalInput
                            decimals={6}
                            min={0}
                            placeholder={String(wasteEntry?.unitCostSnapshot ?? "")}
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormDescription>
                          {t("waste.fields.unitCostOverrideHint") ||
                            "Replaces the frozen historical cost for this entry only — not today's live price."}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}

function reasonKey(reason: WasteReason): string {
  const map: Record<WasteReason, string> = {
    EXPIRED: "expired",
    DAMAGED: "damaged",
    SPOILED: "spoiled",
    OVERPRODUCTION: "overproduction",
    QUALITY_CONTROL: "qualityControl",
    OTHER: "other",
  };
  return map[reason];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
