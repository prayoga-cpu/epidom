"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { useStockAdjustment } from "./hooks/use-stock-adjustment";
import { Loader2, Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Stock item type
export interface StockItem {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
  type: "material" | "product";
}

// Adjustment types
enum AdjustmentType {
  IN = "ADJUSTMENT_IN",
  OUT = "ADJUSTMENT_OUT",
}

// Zod validation schema
const bulkAdjustmentSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string(),
        itemName: z.string(),
        itemType: z.enum(["material", "product"]),
        quantity: z.coerce
          .number()
          .positive("Quantity must be positive")
          .min(0.01, "Quantity must be at least 0.01"),
        adjustmentType: z.nativeEnum(AdjustmentType),
        reason: z.string().min(1, "Reason is required when not using global reason").optional(),
        currentStock: z.number(),
        unit: z.string(),
      })
    )
    .min(1, "At least one item is required"),
  useSameReason: z.boolean(),
  globalReason: z.string().min(1, "Reason is required when using same reason").optional(),
  globalAdjustmentType: z.nativeEnum(AdjustmentType),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});

type BulkAdjustmentFormData = z.infer<typeof bulkAdjustmentSchema>;

interface BulkAdjustmentDialogProps {
  selectedItems: StockItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: React.ReactNode;
}

export function BulkAdjustmentDialog({
  selectedItems,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  triggerButton,
}: BulkAdjustmentDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const params = useParams();
  const storeId = params?.storeId as string;
  const [internalOpen, setInternalOpen] = useState(false);
  const adjustStockMutation = useStockAdjustment(storeId);

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen =
    controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalOpen;

  const form = useForm<BulkAdjustmentFormData>({
    resolver: zodResolver(bulkAdjustmentSchema),
    defaultValues: {
      items: selectedItems.map((item) => ({
        itemId: item.id,
        itemName: item.name,
        itemType: item.type,
        quantity: 1,
        adjustmentType: AdjustmentType.IN,
        reason: "",
        currentStock: item.currentStock,
        unit: item.unit,
      })),
      useSameReason: true,
      globalReason: "",
      globalAdjustmentType: AdjustmentType.IN,
      referenceId: "",
      notes: "",
    },
  });

  const { fields, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchUseSameReason = form.watch("useSameReason");
  const watchGlobalAdjustmentType = form.watch("globalAdjustmentType");

  // Predefined reasons based on adjustment type
  const getPredefinedReasons = (type: AdjustmentType): string[] => {
    switch (type) {
      case AdjustmentType.IN:
        return [
          t("management.editStock.reasons.countCorrection"),
          t("management.editStock.reasons.foundItems"),
          t("management.editStock.reasons.systemError"),
          t("management.editStock.reasons.returned"),
        ];
      case AdjustmentType.OUT:
        return [
          t("management.editStock.reasons.countCorrection"),
          t("management.editStock.reasons.damaged"),
          t("management.editStock.reasons.expired"),
          t("management.editStock.reasons.stolen"),
          t("management.editStock.reasons.systemError"),
        ];
      default:
        return [];
    }
  };

  const onSubmit = async (data: BulkAdjustmentFormData) => {
    try {
      // Determine reason for each item
      const globalReason = data.useSameReason ? data.globalReason : undefined;
      if (data.useSameReason && !globalReason) {
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: t("management.editStock.reasonRequired"),
        });
        return;
      }

      // Process all adjustments
      const adjustments = data.items.map((item) => {
        const reason = data.useSameReason ? globalReason! : item.reason;
        if (!reason) {
          throw new Error(`Reason is required for ${item.itemName}`);
        }

        const isIncrease = item.adjustmentType === AdjustmentType.IN;

        return {
          materialId: item.itemType === "material" ? item.itemId : undefined,
          productId: item.itemType === "product" ? item.itemId : undefined,
          adjustmentType: isIncrease ? ("IN" as const) : ("OUT" as const),
          quantity: item.quantity,
          reason: reason,
          notes: data.notes || undefined,
          referenceId: data.referenceId || undefined,
        };
      });

      // Execute all adjustments sequentially (to maintain order and handle errors properly)
      const results = [];
      const errors = [];

      for (const adjustment of adjustments) {
        try {
          const result = await adjustStockMutation.mutateAsync(adjustment);
          results.push(result);
        } catch (error) {
          const itemName = data.items.find(
            (item) =>
              (adjustment.materialId && item.itemId === adjustment.materialId) ||
              (adjustment.productId && item.itemId === adjustment.productId)
          )?.itemName;

          errors.push({
            item: itemName || "Unknown",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Show results
      if (errors.length === 0) {
        sonnerToast.success(
          t("management.editStock.toasts.bulkAdjustmentRecorded.title") ||
            "Bulk Adjustment Successful",
          {
            description: `${results.length} ${t("management.editStock.toasts.bulkAdjustmentRecorded.description") || "items adjusted successfully"}`,
          }
        );
        form.reset();
        setOpen(false);
      } else if (results.length > 0) {
        sonnerToast.warning("Bulk Adjustment Partially Successful", {
          description: `${results.length} succeeded, ${errors.length} failed`,
        });
        // Show errors
        errors.forEach((err) => {
          sonnerToast.error(`Failed: ${err.item}`, {
            description: err.error,
          });
        });
      } else {
        // All failed
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: t("management.editStock.toasts.bulkAdjustmentFailed.description"),
        });
        errors.forEach((err) => {
          sonnerToast.error(`Failed: ${err.item}`, {
            description: err.error,
          });
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description:
          error instanceof Error
            ? error.message
            : t("management.editStock.toasts.bulkAdjustmentFailed.description"),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerButton && <DialogTrigger asChild>{triggerButton}</DialogTrigger>}
      <FormDialogLayout
        title={t("management.editStock.bulkAdjustmentDialog.title")}
        description={`${t("management.editStock.bulkAdjustmentDialog.description")} (${selectedItems.length} ${t("management.editStock.items")})`}
        maxWidth="xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={adjustStockMutation.isPending}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="submit"
              form="bulk-adjustment-form"
              disabled={adjustStockMutation.isPending || fields.length === 0}
            >
              {adjustStockMutation.isPending && (
                <Loader2 className="mr-1 h-4 w-4 hidden sm:inline animate-spin" />
              )}
              {t("management.editStock.recordAdjustments")} ({fields.length})
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form
            id="bulk-adjustment-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
            {/* Global Settings */}
            <Card className="p-4">
              <h3 className="mb-4 text-sm font-semibold">
                {t("management.editStock.globalSettings")}
              </h3>

              <div className="space-y-4">
                {/* Global Adjustment Type */}
                <FormField
                  control={form.control}
                  name="globalAdjustmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("management.editStock.adjustmentType")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={AdjustmentType.IN}>
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-green-600" />
                              {t("management.editStock.increaseStock")} (+)
                            </div>
                          </SelectItem>
                          <SelectItem value={AdjustmentType.OUT}>
                            <div className="flex items-center gap-2">
                              <TrendingDown className="h-4 w-4 text-orange-600" />
                              {t("management.editStock.decreaseStock")} (-)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Use Same Reason Checkbox */}
                <FormField
                  control={form.control}
                  name="useSameReason"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          {t("management.editStock.useSameReason")}
                        </FormLabel>
                        <FormDescription>
                          {t("management.editStock.useSameReasonDescription")}
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Global Reason (if using same reason) */}
                {watchUseSameReason && (
                  <FormField
                    control={form.control}
                    name="globalReason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("management.editStock.reason")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t("management.editStock.selectReason")}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getPredefinedReasons(watchGlobalAdjustmentType).map((reason) => (
                              <SelectItem key={reason} value={reason}>
                                {reason}
                              </SelectItem>
                            ))}
                            <SelectItem value="other">{t("common.other")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Reference ID (Optional) */}
                <FormField
                  control={form.control}
                  name="referenceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("management.editStock.referenceId")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("management.editStock.referenceIdPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("management.editStock.referenceIdDescription")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>

            <Separator />

            {/* Items List */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {t("management.editStock.itemsToAdjust")} ({fields.length})
                </h3>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => {
                  const item = form.watch(`items.${index}`);
                  return (
                    <Card key={field.id} className="p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{item.itemName}</h4>
                            <Badge variant="outline" className="text-xs">
                              {item.itemType === "material"
                                ? t("management.editStock.material")
                                : t("management.editStock.product")}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {t("management.editStock.currentStock")}: {item.currentStock}{" "}
                            {item.unit}
                          </p>
                        </div>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {/* Quantity */}
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("management.editStock.quantity")} ({item.unit})
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  placeholder="0.00"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Individual Reason (if not using same reason) */}
                        {!watchUseSameReason && (
                          <FormField
                            control={form.control}
                            name={`items.${index}.reason`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("management.editStock.reason")}</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue
                                        placeholder={t("management.editStock.selectReason")}
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {getPredefinedReasons(watchGlobalAdjustmentType).map(
                                      (reason) => (
                                        <SelectItem key={reason} value={reason}>
                                          {reason}
                                        </SelectItem>
                                      )
                                    )}
                                    <SelectItem value="other">
                                      {t("common.other")}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {fields.length === 0 && (
                <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                  {t("management.editStock.noItemsSelected")}
                </div>
              )}
            </div>

            {/* Additional Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("management.editStock.notes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("management.editStock.notesPlaceholder")}
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
